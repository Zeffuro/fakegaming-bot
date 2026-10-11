import { sendChannelMessagePayloadResult } from '../utils/discord.js';
import { getNotificationSuppression } from './notificationSuppression.js';
import { upsertOrSaveJobConfig } from './jobConfigPersistence.js';

export interface JobNotificationManager {
    has: (provider: string, eventId: string) => Promise<boolean>;
    hasForGuild?: (provider: string, eventId: string, guildId: string) => Promise<boolean>;
    getDeliveryStatus: (provider: string, eventId: string, guildId: string) => Promise<'sending' | 'sent' | 'uncertain' | null>;
    claimDelivery: (item: { provider: string; eventId: string; channelId: string; guildId: string }) => Promise<boolean>;
    finishDelivery: (
        provider: string,
        eventId: string,
        guildId: string,
        outcome: { status: 'sent' | 'uncertain'; messageId?: string },
    ) => Promise<void>;
    releaseDelivery: (provider: string, eventId: string, guildId: string) => Promise<void>;
}

export async function hasRecordedJobNotification(
    manager: JobNotificationManager,
    provider: string,
    eventId: string,
    guildId: string,
): Promise<boolean> {
    const guildScopedResult = await manager.hasForGuild?.(provider, eventId, guildId);
    const already = guildScopedResult ?? await manager.has(provider, eventId);
    if (already) {
        const status = await manager.getDeliveryStatus(provider, eventId, guildId);
        if (status === 'sending') throw new Error('Notification delivery is still pending');
        return status !== null;
    }
    return false;
}

export async function sendJobNotification(options: {
    manager: JobNotificationManager;
    provider: string;
    eventId: string;
    channelId: string;
    guildId: string;
    payload: Record<string, unknown>;
}): Promise<boolean> {
    const claimed = await options.manager.claimDelivery({
        provider: options.provider,
        eventId: options.eventId,
        channelId: options.channelId,
        guildId: options.guildId,
    });
    if (!claimed) {
        const status = await options.manager.getDeliveryStatus(options.provider, options.eventId, options.guildId);
        if (status === 'sending' || status === null) throw new Error('Notification delivery is still pending');
        return false;
    }

    let result;
    try {
        result = await sendChannelMessagePayloadResult(options.channelId, options.payload);
    } catch (err) {
        await options.manager.finishDelivery(options.provider, options.eventId, options.guildId, { status: 'uncertain' });
        throw err;
    }
    if (result.status === 'rejected') {
        await options.manager.releaseDelivery(options.provider, options.eventId, options.guildId);
        throw new Error('Discord rejected notification delivery');
    }
    if (result.status !== 'sent' || !hasDiscordMessageId(result.message)) {
        await options.manager.finishDelivery(options.provider, options.eventId, options.guildId, { status: 'uncertain' });
        return false;
    }
    await options.manager.finishDelivery(options.provider, options.eventId, options.guildId, {
        status: 'sent',
        messageId: result.message.id,
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
