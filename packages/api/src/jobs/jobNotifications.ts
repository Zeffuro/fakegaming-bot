import { sendChannelMessagePayload } from '../utils/discord.js';
import { getNotificationSuppression } from './notificationSuppression.js';
import { upsertOrSaveJobConfig } from './jobConfigPersistence.js';

export interface JobNotificationManager {
    has: (provider: string, eventId: string) => Promise<boolean>;
    hasForGuild?: (provider: string, eventId: string, guildId: string) => Promise<boolean>;
    recordIfNew: (item: { provider: string; eventId: string; channelId: string; guildId: string }) => Promise<void>;
}

export async function hasRecordedJobNotification(
    manager: JobNotificationManager,
    provider: string,
    eventId: string,
    guildId: string,
): Promise<boolean> {
    const guildScopedResult = await manager.hasForGuild?.(provider, eventId, guildId);
    return guildScopedResult ?? await manager.has(provider, eventId);
}

export async function sendJobNotification(options: {
    manager: JobNotificationManager;
    provider: string;
    eventId: string;
    channelId: string;
    guildId: string;
    payload: Record<string, unknown>;
}): Promise<boolean> {
    const sent = await sendChannelMessagePayload(options.channelId, options.payload);
    if (!hasDiscordMessageId(sent)) return false;

    await options.manager.recordIfNew({
        provider: options.provider,
        eventId: options.eventId,
        channelId: options.channelId,
        guildId: options.guildId,
    });
    return true;
}

export interface LiveNotificationConfig {
    guildId: string;
    discordChannelId: string;
    isLive?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    cooldownMinutes?: number | null;
    lastNotifiedAt?: string | number | Date | null;
}

export async function syncLiveNotificationState<T extends LiveNotificationConfig>(options: {
    config: T;
    manager: { upsert?: (item: T, fields: string[]) => Promise<unknown> };
    notifications: JobNotificationManager;
    provider: string;
    eventId: string;
    isLive: boolean;
    buildPayload: () => Record<string, unknown>;
    now?: Date;
}): Promise<boolean> {
    if (options.isLive && !options.config.isLive) {
        const now = options.now ?? new Date();
        const already = await hasRecordedJobNotification(options.notifications, options.provider, options.eventId, options.config.guildId);
        const suppression = getNotificationSuppression(options.config, now);
        let sent = false;

        if (!already && !suppression.shouldSuppress) {
            sent = await sendJobNotification({
                manager: options.notifications,
                provider: options.provider,
                eventId: options.eventId,
                channelId: options.config.discordChannelId,
                guildId: options.config.guildId,
                payload: options.buildPayload(),
            });
            if (sent) {
                options.config.lastNotifiedAt = now;
            }
        }

        options.config.isLive = true;
        await upsertOrSaveJobConfig(options.manager, options.config);
        return sent;
    }

    if (!options.isLive && options.config.isLive) {
        options.config.isLive = false;
        await upsertOrSaveJobConfig(options.manager, options.config);
    }

    return false;
}

function hasDiscordMessageId(value: unknown): value is { id: string } {
    return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}
