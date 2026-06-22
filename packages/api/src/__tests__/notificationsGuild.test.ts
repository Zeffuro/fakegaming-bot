import { beforeEach, describe, expect, it } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectForbidden, expectOk, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const guildId = 'testguild1';

beforeEach(async () => {
    await configManager.notificationsManager.removeAll();

    for (const entry of [
        {
            provider: 'twitch',
            eventId: 'stream-1',
            guildId,
            channelId: 'channel-1',
        },
        {
            provider: 'youtube',
            eventId: 'video-1',
            guildId,
            channelId: 'channel-2',
        },
        {
            provider: 'youtube',
            eventId: 'video-other',
            guildId: 'testguild2',
            channelId: 'channel-other',
        },
    ]) {
        await configManager.notificationsManager.recordIfNew(entry);
    }
});

describe('Guild notification history API', () => {
    const client = givenAuthenticatedClient(app);

    it('returns guild-scoped notification delivery history', async () => {
        const res = await client.get(`/api/notifications/guild/${guildId}`);

        expectOk(res);
        expect(res.body).toMatchObject({
            total: 2,
            summary: {
                total: 2,
                byProvider: expect.arrayContaining([
                    { provider: 'twitch', count: 1 },
                    { provider: 'youtube', count: 1 },
                ]),
            },
        });
        expect(res.body.records).toHaveLength(2);
        expect(res.body.records).toEqual(expect.arrayContaining([
            expect.objectContaining({
                provider: 'twitch',
                eventId: 'stream-1',
                guildId,
            }),
            expect.objectContaining({
                provider: 'youtube',
                eventId: 'video-1',
                guildId,
            }),
        ]));
        expect(res.body.records).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                eventId: 'video-other',
            }),
        ]));
    });

    it('applies provider filtering within the authorized guild', async () => {
        const res = await client.get(`/api/notifications/guild/${guildId}?provider=youtube`);

        expectOk(res);
        expect(res.body.total).toBe(1);
        expect(res.body.records).toEqual([
            expect.objectContaining({
                provider: 'youtube',
                eventId: 'video-1',
                guildId,
            }),
        ]);
    });

    it('requires authentication', async () => {
        const res = await client.raw.get(`/api/notifications/guild/${guildId}`);

        expectUnauthorized(res);
    });

    it('rejects guilds the user cannot administer', async () => {
        const res = await client.get('/api/notifications/guild/unknown-guild');

        expectForbidden(res);
    });
});
