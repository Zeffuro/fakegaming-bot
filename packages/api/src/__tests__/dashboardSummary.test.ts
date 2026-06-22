import { beforeEach, describe, expect, it } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectOk, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const guildId = 'testguild1';

beforeEach(async () => {
    await Promise.all([
        configManager.twitchManager.removeAll(),
        configManager.tiktokManager.removeAll(),
        configManager.blueskyManager.removeAll(),
        configManager.youtubeManager.removeAll(),
        configManager.steamNewsSubscriptionManager.removeAll(),
        configManager.patchSubscriptionManager.removeAll(),
        configManager.animeManager.subscriptions.removeAll(),
        configManager.birthdayManager.removeAll(),
    ]);

    await Promise.all([
        configManager.twitchManager.addPlain({ guildId, twitchUsername: 'streamer', discordChannelId: 'chan-twitch' } as any),
        configManager.twitchManager.addPlain({ guildId: 'testguild2', twitchUsername: 'other-streamer', discordChannelId: 'chan-other' } as any),
        configManager.tiktokManager.addPlain({ guildId, tiktokUsername: 'creator', discordChannelId: 'chan-tiktok' } as any),
        configManager.blueskyManager.addPlain({ guildId, blueskyHandle: 'user.bsky.social', discordChannelId: 'chan-bluesky' } as any),
        configManager.youtubeManager.addPlain({ guildId, youtubeChannelId: 'UCaaaaaaaaaaaaaaaaaaaaaa', discordChannelId: 'chan-youtube' } as any),
        configManager.steamNewsSubscriptionManager.addPlain({ guildId, steamAppId: 730, appName: 'Counter-Strike 2', discordChannelId: 'chan-steam' } as any),
        configManager.patchSubscriptionManager.addPlain({ guildId, game: 'league', channelId: 'chan-patch' } as any),
        configManager.animeManager.subscriptions.addPlain({ guildId, targetType: 'channel', anilistId: 1, channelId: 'chan-anime', reminderMinutes: 30 } as any),
        configManager.birthdayManager.addPlain({ guildId, userId: 'birthday-user', channelId: 'chan-birthday', day: 12, month: 6 } as any),
    ]);
});

describe('Dashboard summary API', () => {
    const client = givenAuthenticatedClient(app);

    it('returns guild-scoped notification counts', async () => {
        const res = await client.get(`/api/dashboard/guild/${guildId}/summary`);

        expectOk(res);
        expect(res.body).toEqual({
            guildId,
            counts: {
                twitch: 1,
                tiktok: 1,
                bluesky: 1,
                youtube: 1,
                steamNews: 1,
                patchSubscriptions: 1,
                anime: 1,
                birthdays: 1,
            },
            totalConfigured: 8,
        });
    });

    it('requires authentication', async () => {
        const res = await client.raw.get(`/api/dashboard/guild/${guildId}/summary`);

        expectUnauthorized(res);
    });
});
