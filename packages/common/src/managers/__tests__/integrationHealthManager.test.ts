import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';

describe('IntegrationHealthManager', () => {
    const manager = configManager.integrationHealthManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('records and lists a healthy integration check', async () => {
        await manager.recordSuccess({
            provider: 'twitch',
            configId: 12,
            guildId: 'guild-1',
            channelId: 'channel-1',
            delivered: true,
            metadata: { username: 'streamer' },
            checkedAt: new Date('2026-06-20T10:00:00.000Z'),
        });

        const records = await manager.listForGuild('guild-1', 'twitch');

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
            provider: 'twitch',
            configId: '12',
            guildId: 'guild-1',
            channelId: 'channel-1',
            status: 'healthy',
            consecutiveFailures: 0,
            lastErrorCode: null,
            metadata: { username: 'streamer' },
        });
        expect(new Date(String(records[0].lastDeliveryAt)).toISOString()).toBe('2026-06-20T10:00:00.000Z');
    });

    it('increments failures and clears them after success', async () => {
        await manager.recordFailure({
            provider: 'youtube',
            configId: '7',
            guildId: 'guild-1',
            channelId: 'channel-2',
            errorCode: 'feed failed',
            errorMessage: 'The feed is unavailable',
            checkedAt: new Date('2026-06-20T11:00:00.000Z'),
        });
        await manager.recordFailure({
            provider: 'youtube',
            configId: '7',
            guildId: 'guild-1',
            channelId: 'channel-2',
            errorCode: 'feed failed',
            errorMessage: 'The feed is still unavailable',
            checkedAt: new Date('2026-06-20T11:05:00.000Z'),
        });

        let record = await manager.getForConfig('youtube', '7');
        expect(record).toMatchObject({
            status: 'error',
            consecutiveFailures: 2,
            lastErrorCode: 'FEED_FAILED',
            lastErrorMessage: 'The feed is still unavailable',
        });

        await manager.recordSuccess({
            provider: 'youtube',
            configId: '7',
            guildId: 'guild-1',
            channelId: 'channel-2',
        });

        record = await manager.getForConfig('youtube', '7');
        expect(record).toMatchObject({
            status: 'healthy',
            consecutiveFailures: 0,
            lastErrorCode: null,
            lastErrorMessage: null,
        });
    });

    it('keeps the previous delivery timestamp on successful checks without delivery', async () => {
        await manager.recordSuccess({
            provider: 'bluesky',
            configId: '42',
            guildId: 'guild-1',
            channelId: 'channel-3',
            delivered: true,
            checkedAt: new Date('2026-06-20T12:00:00.000Z'),
        });

        await manager.recordSuccess({
            provider: 'bluesky',
            configId: '42',
            guildId: 'guild-1',
            channelId: 'channel-3',
            checkedAt: new Date('2026-06-20T12:05:00.000Z'),
        });

        const record = await manager.getForConfig('bluesky', '42');

        expect(new Date(String(record?.lastDeliveryAt)).toISOString()).toBe('2026-06-20T12:00:00.000Z');
        expect(new Date(String(record?.lastCheckedAt)).toISOString()).toBe('2026-06-20T12:05:00.000Z');
    });

    it('records explicit paused and unknown statuses', async () => {
        await manager.recordStatus({
            provider: 'tiktok',
            configId: 9,
            guildId: 'guild-1',
            channelId: 'channel-4',
            status: 'paused',
            metadata: { paused: true },
            checkedAt: new Date('2026-06-20T13:00:00.000Z'),
        });

        let record = await manager.getForConfig('tiktok', 9);
        expect(record).toMatchObject({
            provider: 'tiktok',
            configId: '9',
            guildId: 'guild-1',
            channelId: 'channel-4',
            status: 'paused',
            consecutiveFailures: 0,
            metadata: { paused: true },
        });

        await manager.recordStatus({
            provider: 'tiktok',
            configId: 9,
            status: 'unknown',
            metadata: { paused: false },
            checkedAt: new Date('2026-06-20T13:05:00.000Z'),
        });

        record = await manager.getForConfig('tiktok', 9);
        expect(record).toMatchObject({
            guildId: 'guild-1',
            channelId: 'channel-4',
            status: 'unknown',
            consecutiveFailures: 0,
            metadata: { paused: false },
        });
    });

    it('lists records with filtered totals and unfiltered status summary', async () => {
        await manager.recordSuccess({
            provider: 'twitch',
            configId: '1',
            guildId: 'guild-1',
            channelId: 'channel-1',
        });
        await manager.recordFailure({
            provider: 'youtube',
            configId: '2',
            guildId: 'guild-1',
            channelId: 'channel-2',
            errorCode: 'feed_failed',
            errorMessage: 'Feed failed',
        });
        await manager.recordFailure({
            provider: 'youtube',
            configId: '3',
            guildId: 'guild-2',
            channelId: 'channel-3',
            errorCode: 'feed_failed',
            errorMessage: 'Feed failed',
        });

        const result = await manager.list({ guildId: 'guild-1', status: 'error' });

        expect(result.total).toBe(1);
        expect(result.records).toHaveLength(1);
        expect(result.records[0]).toMatchObject({ provider: 'youtube', configId: '2', status: 'error' });
        expect(result.summary).toMatchObject({
            total: 2,
            healthy: 1,
            error: 1,
        });
    });
});
