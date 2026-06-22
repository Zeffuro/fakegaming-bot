import { describe, expect, it } from 'vitest';
import { buildGuildNotificationAnalytics } from '@/lib/guildNotificationAnalytics';
import type { IntegrationHealthRecord, NotificationDeliveryRecord } from '@/lib/api-client';

function healthRecord(partial: Partial<IntegrationHealthRecord>): IntegrationHealthRecord {
    return {
        id: 1,
        provider: 'twitch',
        configId: '1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        status: 'healthy',
        consecutiveFailures: 0,
        ...partial,
    };
}

function notificationRecord(partial: Partial<NotificationDeliveryRecord>): NotificationDeliveryRecord {
    return {
        id: 1,
        provider: 'twitch',
        eventId: 'event-1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        messageId: 'message-1',
        createdAt: '2026-06-22T10:30:00.000Z',
        updatedAt: '2026-06-22T10:30:00.000Z',
        ...partial,
    };
}

describe('buildGuildNotificationAnalytics', () => {
    it('builds provider health, delivery totals, and a seven-day trend', () => {
        const analytics = buildGuildNotificationAnalytics({
            configs: [
                { providerKey: 'twitch', providerLabel: 'Twitch', configId: '1' },
                { providerKey: 'twitch', providerLabel: 'Twitch', configId: '2', paused: true },
                { providerKey: 'youtube', providerLabel: 'YouTube', configId: '3' },
            ],
            healthRecords: [
                healthRecord({ provider: 'twitch', configId: '1', status: 'error' }),
                healthRecord({ provider: 'twitch', configId: '2', status: 'paused' }),
                healthRecord({ provider: 'youtube', configId: '3', status: 'warning' }),
            ],
            notificationProviders: [
                { provider: 'twitch', count: 4 },
                { provider: 'youtube', count: 2 },
            ],
            notificationRecords: [
                notificationRecord({ id: 1, provider: 'twitch', createdAt: '2026-06-22T10:30:00.000Z' }),
                notificationRecord({ id: 2, provider: 'twitch', createdAt: '2026-06-21T10:30:00.000Z' }),
                notificationRecord({ id: 3, provider: 'youtube', createdAt: '2026-06-16T10:30:00.000Z' }),
                notificationRecord({ id: 4, provider: 'youtube', createdAt: '2026-06-10T10:30:00.000Z' }),
            ],
            now: new Date('2026-06-22T12:00:00.000Z'),
        });

        expect(analytics).toMatchObject({
            totalConfigured: 3,
            activeConfigs: 2,
            pausedConfigs: 1,
            totalDeliveries: 6,
            healthErrors: 1,
            healthWarnings: 1,
            lastDeliveryAt: '2026-06-22T10:30:00.000Z',
        });
        expect(analytics.providers).toMatchObject([
            {
                providerKey: 'twitch',
                providerLabel: 'Twitch',
                configured: 2,
                active: 1,
                paused: 1,
                deliveries: 4,
                healthErrors: 1,
                status: 'critical',
            },
            {
                providerKey: 'youtube',
                providerLabel: 'YouTube',
                configured: 1,
                deliveries: 2,
                healthWarnings: 1,
                status: 'warning',
            },
        ]);
        expect(analytics.trend).toEqual([
            { date: '2026-06-16', deliveries: 1 },
            { date: '2026-06-17', deliveries: 0 },
            { date: '2026-06-18', deliveries: 0 },
            { date: '2026-06-19', deliveries: 0 },
            { date: '2026-06-20', deliveries: 0 },
            { date: '2026-06-21', deliveries: 1 },
            { date: '2026-06-22', deliveries: 1 },
        ]);
    });

    it('includes delivery-only providers and normalizes provider keys', () => {
        const analytics = buildGuildNotificationAnalytics({
            configs: [],
            healthRecords: [
                healthRecord({ provider: 'Patch Notes', configId: 'patch-1', status: 'unknown' }),
            ],
            notificationProviders: [
                { provider: 'birthdays', count: 3 },
            ],
            notificationRecords: [
                notificationRecord({ provider: 'birthday', createdAt: '2026-06-22T09:00:00.000Z' }),
            ],
            now: new Date('2026-06-22T12:00:00.000Z'),
        });

        expect(analytics.providers).toMatchObject([
            {
                providerKey: 'patchnotes',
                providerLabel: 'Patch Notes',
                healthUnknown: 1,
                status: 'warning',
            },
            {
                providerKey: 'birthday',
                providerLabel: 'Birthdays',
                deliveries: 3,
                status: 'healthy',
            },
        ]);
    });
});
