import {
    ChannelType,
    Events,
    PermissionFlagsBits,
    type Client,
    type Guild,
    type VoiceChannel,
    type VoiceState,
} from 'discord.js';
import {
    entersState,
    getVoiceConnection,
    joinVoiceChannel,
    VoiceConnectionStatus,
    type VoiceConnection,
} from '@discordjs/voice';
import {
    getLogger,
    type VoiceChannelOccupancyConfigRecord,
} from '@zeffuro/fakegaming-common';

const READY_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 300_000] as const;

const logger = getLogger({ name: 'bot:voice-channel-occupancy' });

export type VoiceChannelOccupancyTargetErrorCode =
    | 'guild-unavailable'
    | 'channel-unavailable'
    | 'not-voice-channel'
    | 'missing-permissions'
    | 'channel-full';

export type VoiceChannelOccupancyConfigureResult =
    | { state: 'ready' }
    | { state: 'retrying' }
    | { state: 'failed'; code: VoiceChannelOccupancyTargetErrorCode };

export type VoiceChannelOccupancyRuntimeStatus = 'ready' | 'connecting' | 'disconnected';

interface VoiceRuntimeDependencies {
    joinVoiceChannel: typeof joinVoiceChannel;
    entersState: typeof entersState;
    getVoiceConnection: typeof getVoiceConnection;
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
}

const defaultDependencies: VoiceRuntimeDependencies = {
    joinVoiceChannel,
    entersState,
    getVoiceConnection,
    setTimeout,
    clearTimeout,
};

export class VoiceChannelOccupancyRuntime {
    private readonly dependencies: VoiceRuntimeDependencies;
    private readonly readyTimeoutMs: number;
    private readonly retryDelaysMs: readonly number[];
    private readonly desired = new Map<string, VoiceChannelOccupancyConfigRecord>();
    private readonly ownedConnections = new Map<string, VoiceConnection>();
    private readonly attachedConnections = new WeakSet<VoiceConnection>();
    private readonly retryAttempts = new Map<string, number>();
    private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly operations = new Map<string, Promise<unknown>>();
    private client: Client | null = null;
    private voiceStateListenerAttached = false;

    constructor(options: {
        dependencies?: Partial<VoiceRuntimeDependencies>;
        readyTimeoutMs?: number;
        retryDelaysMs?: readonly number[];
    } = {}) {
        this.dependencies = { ...defaultDependencies, ...options.dependencies };
        this.readyTimeoutMs = options.readyTimeoutMs ?? READY_TIMEOUT_MS;
        this.retryDelaysMs = options.retryDelaysMs ?? RETRY_DELAYS_MS;
    }

    async start(
        client: Client,
        configs: readonly VoiceChannelOccupancyConfigRecord[],
    ): Promise<{ ready: number; retrying: number; failed: number }> {
        this.client = client;
        if (!this.voiceStateListenerAttached) {
            client.on(Events.VoiceStateUpdate, this.handleVoiceStateUpdate);
            this.voiceStateListenerAttached = true;
        }

        const results = await Promise.all(configs.map(config => this.configure(client, config)));
        return {
            ready: results.filter(result => result.state === 'ready').length,
            retrying: results.filter(result => result.state === 'retrying').length,
            failed: results.filter(result => result.state === 'failed').length,
        };
    }

    async configure(
        client: Client,
        config: VoiceChannelOccupancyConfigRecord,
    ): Promise<VoiceChannelOccupancyConfigureResult> {
        this.client = client;
        const previous = this.desired.get(config.guildId);
        const changedChannel = previous?.channelId !== config.channelId;
        this.desired.set(config.guildId, config);
        this.cancelRetry(config.guildId);
        this.retryAttempts.delete(config.guildId);

        const result = await this.runSerialized(config.guildId, () => this.connect(config));
        if (result.state === 'failed') {
            if (previous) {
                this.desired.set(config.guildId, previous);
                if (changedChannel && this.getStatus(previous.guildId, previous.channelId) !== 'ready') {
                    this.scheduleRetry(previous);
                }
            } else {
                this.desired.delete(config.guildId);
            }
        }
        return result;
    }

    async disable(guildId: string): Promise<void> {
        this.desired.delete(guildId);
        this.cancelRetry(guildId);
        this.retryAttempts.delete(guildId);

        await this.runSerialized(guildId, async () => {
            const connection = this.ownedConnections.get(guildId);
            this.ownedConnections.delete(guildId);
            if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        });
    }

    getStatus(guildId: string, channelId: string): VoiceChannelOccupancyRuntimeStatus {
        const connection = this.ownedConnections.get(guildId)
            ?? this.dependencies.getVoiceConnection(guildId);
        if (!connection || connection.joinConfig.channelId !== channelId) {
            return this.retryTimers.has(guildId) ? 'connecting' : 'disconnected';
        }
        if (connection.state.status === VoiceConnectionStatus.Ready) return 'ready';
        if (
            connection.state.status === VoiceConnectionStatus.Connecting
            || connection.state.status === VoiceConnectionStatus.Signalling
        ) {
            return 'connecting';
        }
        return this.retryTimers.has(guildId) ? 'connecting' : 'disconnected';
    }

    private readonly handleVoiceStateUpdate = (_oldState: VoiceState, newState: VoiceState): void => {
        if (!this.client?.user || newState.id !== this.client.user.id) return;
        const config = this.desired.get(newState.guild.id);
        if (config && newState.channelId !== config.channelId) {
            this.scheduleRetry(config);
        }
    };

    private async connect(config: VoiceChannelOccupancyConfigRecord): Promise<VoiceChannelOccupancyConfigureResult> {
        const client = this.client;
        if (!client || this.desired.get(config.guildId)?.channelId !== config.channelId) {
            return { state: 'failed', code: 'guild-unavailable' };
        }

        let target: { guild: Guild; channel: VoiceChannel };
        try {
            target = await this.resolveTarget(client, config);
        } catch (error) {
            if (error instanceof VoiceChannelOccupancyTargetError) {
                logger.warn({ guildId: config.guildId, channelId: config.channelId, code: error.code }, error.message);
                return { state: 'failed', code: error.code };
            }
            logger.warn({ err: error, guildId: config.guildId, channelId: config.channelId }, 'Failed to resolve occupied voice channel');
            this.scheduleRetry(config);
            return { state: 'retrying' };
        }

        const existing = this.dependencies.getVoiceConnection(config.guildId);
        if (
            existing
            && existing.joinConfig.channelId === config.channelId
            && existing.state.status === VoiceConnectionStatus.Ready
        ) {
            this.ownedConnections.set(config.guildId, existing);
            this.attachConnection(existing, config.guildId);
            this.markReady(config.guildId);
            return { state: 'ready' };
        }

        const connection = this.dependencies.joinVoiceChannel({
            channelId: target.channel.id,
            guildId: target.guild.id,
            adapterCreator: target.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true,
        });
        this.ownedConnections.set(config.guildId, connection);
        this.attachConnection(connection, config.guildId);

        try {
            await this.dependencies.entersState(connection, VoiceConnectionStatus.Ready, this.readyTimeoutMs);
            this.markReady(config.guildId);
            return { state: 'ready' };
        } catch (error) {
            logger.warn({ err: error, guildId: config.guildId, channelId: config.channelId }, 'Voice channel occupancy connection is not ready; retry scheduled');
            this.scheduleRetry(config);
            return { state: 'retrying' };
        }
    }

    private async resolveTarget(
        client: Client,
        config: VoiceChannelOccupancyConfigRecord,
    ): Promise<{ guild: Guild; channel: VoiceChannel }> {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) {
            throw new VoiceChannelOccupancyTargetError('guild-unavailable', 'Configured guild is unavailable to the bot.');
        }

        let channel;
        try {
            channel = await guild.channels.fetch(config.channelId);
        } catch {
            throw new VoiceChannelOccupancyTargetError('channel-unavailable', 'Configured voice channel is unavailable to the bot.');
        }
        if (!channel) {
            throw new VoiceChannelOccupancyTargetError('channel-unavailable', 'Configured voice channel no longer exists.');
        }
        if (channel.type !== ChannelType.GuildVoice) {
            throw new VoiceChannelOccupancyTargetError('not-voice-channel', 'Configured channel is not a normal voice channel.');
        }

        const member = guild.members.me ?? await guild.members.fetchMe();
        const permissions = channel.permissionsFor(member);
        if (
            !permissions.has(PermissionFlagsBits.ViewChannel)
            || !permissions.has(PermissionFlagsBits.Connect)
        ) {
            throw new VoiceChannelOccupancyTargetError('missing-permissions', 'Bot lacks View Channel or Connect in the configured voice channel.');
        }

        const alreadyPresent = channel.members.has(member.id);
        const bypassesLimit = permissions.has(PermissionFlagsBits.MoveMembers);
        if (
            channel.userLimit > 0
            && channel.members.size >= channel.userLimit
            && !alreadyPresent
            && !bypassesLimit
        ) {
            throw new VoiceChannelOccupancyTargetError('channel-full', 'Configured voice channel is full.');
        }

        return { guild, channel };
    }

    private attachConnection(connection: VoiceConnection, guildId: string): void {
        if (this.attachedConnections.has(connection)) return;
        this.attachedConnections.add(connection);

        connection.on('error', error => {
            logger.warn({ err: error, guildId }, 'Voice channel occupancy connection error');
        });
        connection.on('stateChange', (_oldState, newState) => {
            if (newState.status === VoiceConnectionStatus.Ready) {
                this.markReady(guildId);
                return;
            }
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                const config = this.desired.get(guildId);
                if (config) this.scheduleRetry(config);
                return;
            }
            if (
                newState.status === VoiceConnectionStatus.Destroyed
                && this.ownedConnections.get(guildId) === connection
            ) {
                this.ownedConnections.delete(guildId);
                const config = this.desired.get(guildId);
                if (config) this.scheduleRetry(config);
            }
        });
    }

    private scheduleRetry(config: VoiceChannelOccupancyConfigRecord): void {
        if (
            this.retryTimers.has(config.guildId)
            || this.desired.get(config.guildId)?.channelId !== config.channelId
        ) {
            return;
        }

        const attempt = this.retryAttempts.get(config.guildId) ?? 0;
        const delay = this.retryDelaysMs[Math.min(attempt, this.retryDelaysMs.length - 1)] ?? 300_000;
        this.retryAttempts.set(config.guildId, attempt + 1);
        const timer = this.dependencies.setTimeout(() => {
            this.retryTimers.delete(config.guildId);
            void this.runSerialized(config.guildId, async () => {
                const desired = this.desired.get(config.guildId);
                if (!desired || desired.channelId !== config.channelId) return;
                await this.connect(desired);
            });
        }, delay);
        timer.unref?.();
        this.retryTimers.set(config.guildId, timer);
    }

    private markReady(guildId: string): void {
        this.cancelRetry(guildId);
        this.retryAttempts.delete(guildId);
    }

    private cancelRetry(guildId: string): void {
        const timer = this.retryTimers.get(guildId);
        if (timer) this.dependencies.clearTimeout(timer);
        this.retryTimers.delete(guildId);
    }

    private runSerialized<T>(guildId: string, operation: () => Promise<T>): Promise<T> {
        const previous = this.operations.get(guildId) ?? Promise.resolve();
        const current = previous.catch(() => undefined).then(operation);
        this.operations.set(guildId, current);
        void current.then(
            () => this.clearOperation(guildId, current),
            () => this.clearOperation(guildId, current),
        );
        return current;
    }

    private clearOperation(guildId: string, operation: Promise<unknown>): void {
        if (this.operations.get(guildId) === operation) this.operations.delete(guildId);
    }
}

class VoiceChannelOccupancyTargetError extends Error {
    constructor(
        readonly code: VoiceChannelOccupancyTargetErrorCode,
        message: string,
    ) {
        super(message);
    }
}

export const voiceChannelOccupancyRuntime = new VoiceChannelOccupancyRuntime();
