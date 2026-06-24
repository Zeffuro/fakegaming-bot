import { describe, expect, it } from 'vitest';
import {
    buildGuildNotificationAnalytics,
    buildGuildNotificationAnalyticsCsvRows,
    parseGuildAnalyticsWindowDays,
    serializeGuildAnalyticsWindowDays,
} from '@/lib/guildNotificationAnalytics';
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

    it('uses server-provided delivery trend when available', () => {
        const analytics = buildGuildNotificationAnalytics({
            notificationRecords: [
                notificationRecord({ provider: 'twitch', createdAt: '2026-06-22T09:00:00.000Z' }),
            ],
            notificationTrend: [
                { date: '2026-06-20', count: 3 },
                { date: '2026-06-21', count: 0 },
                { date: '2026-06-22', count: 5 },
            ],
            now: new Date('2026-06-22T12:00:00.000Z'),
        });

        expect(analytics.trend).toEqual([
            { date: '2026-06-20', deliveries: 3 },
            { date: '2026-06-21', deliveries: 0 },
            { date: '2026-06-22', deliveries: 5 },
        ]);
    });

    it('summarizes provider outcomes from health and delivery records', () => {
        const analytics = buildGuildNotificationAnalytics({
            healthRecords: [
                healthRecord({
                    provider: 'twitch',
                    configId: 'twitch-1',
                    status: 'error',
                    consecutiveFailures: 3,
                    lastFailureAt: '2026-06-21T10:00:00.000Z',
                    lastDeliveryAt: '2026-06-20T10:00:00.000Z',
                }),
                healthRecord({
                    provider: 'twitch',
                    configId: 'twitch-2',
                    status: 'warning',
                    consecutiveFailures: 2,
                    lastFailureAt: '2026-06-22T08:00:00.000Z',
                }),
                healthRecord({
                    provider: 'youtube',
                    configId: 'youtube-1',
                    status: 'healthy',
                    lastDeliveryAt: '2026-06-22T12:00:00.000Z',
                }),
            ],
            notificationProviders: [
                { provider: 'twitch', count: 6 },
                { provider: 'youtube', count: 2 },
            ],
            notificationRecords: [
                notificationRecord({ provider: 'twitch', createdAt: '2026-06-22T09:00:00.000Z' }),
                notificationRecord({ provider: 'youtube', createdAt: '2026-06-21T09:00:00.000Z' }),
            ],
        });

        expect(analytics.providers.find(provider => provider.providerKey === 'twitch')).toMatchObject({
            healthErrors: 1,
            healthWarnings: 1,
            consecutiveFailures: 5,
            lastFailureAt: '2026-06-22T08:00:00.000Z',
            lastDeliveryAt: '2026-06-22T09:00:00.000Z',
            deliveries: 6,
        });
        expect(analytics.providers.find(provider => provider.providerKey === 'youtube')).toMatchObject({
            healthHealthy: 1,
            consecutiveFailures: 0,
            lastFailureAt: null,
            lastDeliveryAt: '2026-06-22T12:00:00.000Z',
            deliveries: 2,
        });
    });

    it('maps summary, provider, and trend rows for CSV export', () => {
        const analytics = buildGuildNotificationAnalytics({
            configs: [
                { providerKey: 'twitch', providerLabel: 'Twitch', configId: '1' },
            ],
            healthRecords: [
                healthRecord({
                    provider: 'twitch',
                    configId: '1',
                    status: 'error',
                    consecutiveFailures: 2,
                    lastFailureAt: '2026-06-22T08:00:00.000Z',
                }),
            ],
            notificationProviders: [
                { provider: 'twitch', count: 4 },
            ],
            notificationTrend: [
                { date: '2026-06-21', count: 1 },
                { date: '2026-06-22', count: 3 },
            ],
        });

        expect(buildGuildNotificationAnalyticsCsvRows(analytics, 30)).toEqual([
            ['summary', 30, '', '', 'totalConfigured', 1, '', '', '', '', '', '', '', '', '', '', ''],
            ['summary', 30, '', '', 'activeConfigs', 1, '', '', '', '', '', '', '', '', '', '', ''],
            ['summary', 30, '', '', 'pausedConfigs', 0, '', '', '', '', '', '', '', '', '', '', ''],
            ['summary', 30, '', '', 'totalDeliveries', 4, '', '', '', '', '', '', '', '', '', '', ''],
            ['summary', 30, '', '', 'healthErrors', 1, '', '', '', '', '', '', '', '', '', '', ''],
            ['summary', 30, '', '', 'healthWarnings', 0, '', '', '', '', '', '', '', '', '', '', ''],
            ['summary', 30, '', '', 'lastDeliveryAt', null, '', '', '', '', '', '', '', '', '', '', null],
            ['provider', 30, 'Twitch', '', 'providerSummary', '', 'critical', 1, 1, 0, 4, 1, 0, 0, 2, '2026-06-22T08:00:00.000Z', null],
            ['trend', 30, '', '2026-06-21', 'deliveries', 1, '', '', '', '', 1, '', '', '', '', '', ''],
            ['trend', 30, '', '2026-06-22', 'deliveries', 3, '', '', '', '', 3, '', '', '', '', '', ''],
        ]);
    });
});

describe('guild analytics window params', () => {
    it('parses supported dashboard analytics windows', () => {
        expect(parseGuildAnalyticsWindowDays(params('days=7'))).toBe(7);
        expect(parseGuildAnalyticsWindowDays(params('days=30'))).toBe(30);
        expect(parseGuildAnalyticsWindowDays(params('days=90'))).toBe(90);
    });

    it('falls back to the default window for unsupported values', () => {
        expect(parseGuildAnalyticsWindowDays(params(''))).toBe(30);
        expect(parseGuildAnalyticsWindowDays(params('days=14'))).toBe(30);
        expect(parseGuildAnalyticsWindowDays(params('days=bad'))).toBe(30);
    });

    it('serializes non-default windows while preserving unrelated params', () => {
        expect(serializeGuildAnalyticsWindowDays(params('provider=twitch'), 7)).toBe('provider=twitch&days=7');
        expect(serializeGuildAnalyticsWindowDays(params('provider=twitch&days=90'), 30)).toBe('provider=twitch');
    });
});

function params(value: string): URLSearchParams {
    return new URLSearchParams(value);
}
