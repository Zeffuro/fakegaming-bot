import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ChannelType,
    Events,
    PermissionFlagsBits,
    PermissionsBitField,
    type Client,
    type Guild,
    type VoiceChannel,
    type VoiceState,
} from 'discord.js';
import { VoiceConnectionStatus, type VoiceConnection } from '@discordjs/voice';
import { VoiceChannelOccupancyRuntime } from '../shared/voiceChannelOccupancyRuntime.js';

class MockVoiceConnection extends EventEmitter {
    state = { status: VoiceConnectionStatus.Connecting };
    joinConfig: { channelId: string; guildId: string };
    destroy = vi.fn(() => {
        const oldState = this.state;
        this.state = { status: VoiceConnectionStatus.Destroyed };
        this.emit('stateChange', oldState, this.state);
    });

    constructor(guildId: string, channelId: string) {
        super();
        this.joinConfig = { guildId, channelId };
    }
}

interface GuildOptions {
    channelMissing?: boolean;
    channelType?: ChannelType;
    fetchChannelError?: boolean;
    memberCached?: boolean;
    memberPresent?: boolean;
    memberCount?: number;
    userLimit?: number;
}

function createGuild(
    guildId: string,
    channelId: string,
    permissionBits = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
    options: GuildOptions = {},
): Guild {
    const member = { id: 'bot-1' };
    const members = new Map(
        Array.from({ length: options.memberCount ?? 0 }, (_, index) => [`member-${index}`, {}]),
    );
    if (options.memberPresent) members.set(member.id, member);
    const channel = {
        id: channelId,
        type: options.channelType ?? ChannelType.GuildVoice,
        userLimit: options.userLimit ?? 0,
        members,
        permissionsFor: vi.fn(() => new PermissionsBitField(permissionBits)),
    } as unknown as VoiceChannel;
    const fetch = options.fetchChannelError
        ? vi.fn().mockRejectedValue(new Error('channel fetch failed'))
        : vi.fn().mockResolvedValue(options.channelMissing ? null : channel);
    return {
        id: guildId,
        voiceAdapterCreator: vi.fn(),
        channels: { fetch },
        members: {
            me: options.memberCached === false ? null : member,
            fetchMe: vi.fn().mockResolvedValue(member),
        },
    } as unknown as Guild;
}

function createClient(guilds: Guild[]): Client {
    return {
        user: { id: 'bot-1' },
        guilds: { cache: new Map(guilds.map(guild => [guild.id, guild])) },
        on: vi.fn(),
    } as unknown as Client;
}

describe('VoiceChannelOccupancyRuntime', () => {
    const connections = new Map<string, MockVoiceConnection>();
    const join = vi.fn((options: { guildId: string; channelId: string }) => {
        const connection = new MockVoiceConnection(options.guildId, options.channelId);
        connections.set(options.guildId, connection);
        return connection as unknown as VoiceConnection;
    });
    const enterReady = vi.fn(async (connection: VoiceConnection) => {
        (connection as unknown as MockVoiceConnection).state = { status: VoiceConnectionStatus.Ready };
        return connection;
    });

    beforeEach(() => {
        connections.clear();
        join.mockClear();
        enterReady.mockClear();
    });

    function createRuntime(entersState = enterReady) {
        return new VoiceChannelOccupancyRuntime({
            dependencies: {
                joinVoiceChannel: join as never,
                entersState: entersState as never,
                getVoiceConnection: ((guildId: string) => connections.get(guildId)) as never,
            },
        });
    }

    it('restores independent muted and deafened connections for two guilds', async () => {
        const runtime = createRuntime();
        const client = createClient([
            createGuild('guild-1', 'voice-1'),
            createGuild('guild-2', 'voice-2'),
        ]);

        await expect(runtime.start(client, [
            { guildId: 'guild-1', channelId: 'voice-1' },
            { guildId: 'guild-2', channelId: 'voice-2' },
        ])).resolves.toEqual({ ready: 2, retrying: 0, failed: 0 });

        expect(join).toHaveBeenCalledTimes(2);
        expect(join).toHaveBeenCalledWith(expect.objectContaining({
            guildId: 'guild-1',
            channelId: 'voice-1',
            selfDeaf: true,
            selfMute: true,
        }));
        expect(join).toHaveBeenCalledWith(expect.objectContaining({
            guildId: 'guild-2',
            channelId: 'voice-2',
            selfDeaf: true,
            selfMute: true,
        }));
        expect(runtime.getStatus('guild-1', 'voice-1')).toBe('ready');
        expect(runtime.getStatus('guild-2', 'voice-2')).toBe('ready');
    });

    it('rejects a channel when View Channel or Connect is missing', async () => {
        const runtime = createRuntime();
        const client = createClient([createGuild('guild-1', 'voice-1', [PermissionFlagsBits.ViewChannel])]);

        await expect(runtime.configure(client, { guildId: 'guild-1', channelId: 'voice-1' }))
            .resolves.toEqual({ state: 'failed', code: 'missing-permissions' });
        expect(join).not.toHaveBeenCalled();
    });

    it('keeps a transient connection failure in retrying state', async () => {
        const failToEnter = vi.fn().mockRejectedValue(new Error('voice gateway unavailable'));
        const runtime = createRuntime(failToEnter);
        const client = createClient([createGuild('guild-1', 'voice-1')]);

        await expect(runtime.configure(client, { guildId: 'guild-1', channelId: 'voice-1' }))
            .resolves.toEqual({ state: 'retrying' });
        expect(runtime.getStatus('guild-1', 'voice-1')).toBe('connecting');
        await runtime.disable('guild-1');
    });

    it('destroys only the configured guild connection when disabled', async () => {
        const runtime = createRuntime();
        const client = createClient([
            createGuild('guild-1', 'voice-1'),
            createGuild('guild-2', 'voice-2'),
        ]);
        await runtime.start(client, [
            { guildId: 'guild-1', channelId: 'voice-1' },
            { guildId: 'guild-2', channelId: 'voice-2' },
        ]);

        await runtime.disable('guild-1');

        expect(connections.get('guild-1')?.destroy).toHaveBeenCalledOnce();
        expect(connections.get('guild-2')?.destroy).not.toHaveBeenCalled();
        expect(runtime.getStatus('guild-2', 'voice-2')).toBe('ready');
    });

    it('reuses an existing ready connection and reports connection states', async () => {
        const runtime = createRuntime();
        const client = createClient([createGuild('guild-1', 'voice-1')]);
        const config = { guildId: 'guild-1', channelId: 'voice-1' };

        await runtime.start(client, [config]);
        await runtime.start(client, [config]);

        expect(join).toHaveBeenCalledOnce();
        const connection = connections.get('guild-1')!;
        connection.state = { status: VoiceConnectionStatus.Signalling };
        expect(runtime.getStatus('guild-1', 'voice-1')).toBe('connecting');
        connection.state = { status: VoiceConnectionStatus.Disconnected };
        expect(runtime.getStatus('guild-1', 'voice-1')).toBe('disconnected');
        expect(runtime.getStatus('guild-1', 'another-channel')).toBe('disconnected');

        const external = new MockVoiceConnection('guild-2', 'voice-2');
        external.state = { status: VoiceConnectionStatus.Ready };
        connections.set('guild-2', external);
        expect(runtime.getStatus('guild-2', 'voice-2')).toBe('ready');
    });

    it.each([
        ['guild-unavailable', createClient([]), 'guild-1', 'voice-1'],
        ['channel-unavailable', createClient([
            createGuild('guild-2', 'voice-2', undefined, { fetchChannelError: true }),
        ]), 'guild-2', 'voice-2'],
        ['channel-unavailable', createClient([
            createGuild('guild-3', 'voice-3', undefined, { channelMissing: true }),
        ]), 'guild-3', 'voice-3'],
        ['not-voice-channel', createClient([
            createGuild('guild-4', 'voice-4', undefined, { channelType: ChannelType.GuildText }),
        ]), 'guild-4', 'voice-4'],
        ['channel-full', createClient([
            createGuild('guild-5', 'voice-5', undefined, { userLimit: 1, memberCount: 1 }),
        ]), 'guild-5', 'voice-5'],
    ] as const)('rejects invalid targets with %s', async (code, client, guildId, channelId) => {
        const runtime = createRuntime();

        await expect(runtime.configure(client, { guildId, channelId }))
            .resolves.toEqual({ state: 'failed', code });
        expect(join).not.toHaveBeenCalled();
    });

    it('allows a full channel when the bot can bypass the limit and fetches an uncached member', async () => {
        const runtime = createRuntime();
        const guild = createGuild(
            'guild-1',
            'voice-1',
            [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers],
            { userLimit: 1, memberCount: 1, memberCached: false },
        );

        await expect(runtime.configure(createClient([guild]), { guildId: 'guild-1', channelId: 'voice-1' }))
            .resolves.toEqual({ state: 'ready' });
        expect(guild.members.fetchMe).toHaveBeenCalledOnce();
    });

    it('reacts to voice state and connection state changes', async () => {
        const runtime = createRuntime();
        const client = createClient([createGuild('guild-1', 'voice-1')]);
        await runtime.start(client, [{ guildId: 'guild-1', channelId: 'voice-1' }]);
        const connection = connections.get('guild-1')!;

        connection.emit('error', new Error('test connection error'));
        connection.state = { status: VoiceConnectionStatus.Ready };
        connection.emit('stateChange', connection.state, { status: VoiceConnectionStatus.Ready });
        connection.state = { status: VoiceConnectionStatus.Disconnected };
        connection.emit('stateChange', connection.state, { status: VoiceConnectionStatus.Disconnected });
        expect(runtime.getStatus('guild-1', 'voice-1')).toBe('connecting');

        const voiceStateHandler = vi.mocked(client.on).mock.calls
            .find(([event]) => event === Events.VoiceStateUpdate)?.[1] as unknown as (
                oldState: VoiceState,
                newState: VoiceState,
            ) => void;
        voiceStateHandler({} as VoiceState, { id: 'another-user', guild: { id: 'guild-1' } } as VoiceState);
        voiceStateHandler({} as VoiceState, {
            id: 'bot-1',
            channelId: null,
            guild: { id: 'guild-1' },
        } as VoiceState);

        connection.state = { status: VoiceConnectionStatus.Destroyed };
        connection.emit('stateChange', { status: VoiceConnectionStatus.Ready }, connection.state);
        await runtime.disable('guild-1');
    });
});
