import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';

describe('NotificationsManager', () => {
    const manager = configManager.notificationsManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('checks notification existence globally and by guild', async () => {
        await manager.recordIfNew({
            provider: 'youtube',
            eventId: 'video-1',
            guildId: 'guild-1',
        });

        await expect(manager.has('youtube', 'video-1')).resolves.toBe(true);
        await expect(manager.has('youtube', 'missing')).resolves.toBe(false);
        await expect(manager.hasForGuild('youtube', 'video-1', 'guild-1')).resolves.toBe(true);
        await expect(manager.hasForGuild('youtube', 'video-1', 'guild-2')).resolves.toBe(false);
    });

    it('records a notification once per provider event', async () => {
        const first = await manager.recordIfNew({
            provider: 'twitch',
            eventId: 'stream-1',
            guildId: 'guild-1',
        });
        const second = await manager.recordIfNew({
            provider: 'twitch',
            eventId: 'stream-1',
            guildId: 'guild-2',
        });

        expect(first.created).toBe(true);
        expect(second.created).toBe(false);
        expect(second.record.id).toBe(first.record.id);
    });

    it('upserts message metadata for an existing or new notification', async () => {
        await manager.recordIfNew({ provider: 'youtube', eventId: 'video-1' });
        await manager.setMessageMeta('youtube', 'video-1', {
            guildId: 'guild-1',
            channelId: 'channel-1',
            messageId: 'message-1',
        });
        await manager.setMessageMeta('bluesky', 'post-1', {
            guildId: 'guild-2',
            channelId: 'channel-2',
            messageId: 'message-2',
        });

        const result = await manager.list({ limit: 10 });

        expect(result.total).toBe(2);
        expect(result.records).toEqual(expect.arrayContaining([
            expect.objectContaining({
                provider: 'youtube',
                eventId: 'video-1',
                guildId: 'guild-1',
                channelId: 'channel-1',
                messageId: 'message-1',
            }),
            expect.objectContaining({
                provider: 'bluesky',
                eventId: 'post-1',
                guildId: 'guild-2',
                channelId: 'channel-2',
                messageId: 'message-2',
            }),
        ]));
    });

    it('lists recent notifications with filters, pagination, and provider summary', async () => {
        await manager.recordIfNew({ provider: 'twitch', eventId: 'stream-1', guildId: 'guild-1' });
        await manager.recordIfNew({ provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' });
        await manager.recordIfNew({ provider: 'youtube', eventId: 'video-2', guildId: 'guild-2' });

        const result = await manager.list({ guildId: 'guild-1', limit: 1 });

        expect(result.total).toBe(2);
        expect(result.limit).toBe(1);
        expect(result.records).toHaveLength(1);
        expect(result.summary).toEqual({
            total: 2,
            byProvider: expect.arrayContaining([
                { provider: 'twitch', count: 1 },
                { provider: 'youtube', count: 1 },
            ]),
        });
    });
});
