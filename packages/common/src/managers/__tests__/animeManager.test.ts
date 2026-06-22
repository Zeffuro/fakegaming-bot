import { beforeEach, describe, expect, it } from 'vitest';
import { AnimeSubscriptionConfig } from '../../models/anime-subscription-config.js';
import { configManager } from '../../vitest.setup.js';

describe('AnimeManager', () => {
    const animeManager = configManager.animeManager;

    beforeEach(async () => {
        await animeManager.subscriptions.removeAll();
        await animeManager.episodes.removeAll();
        await animeManager.titles.removeAll();
    });

    it('upserts titles and parses persisted genre payloads safely', async () => {
        await animeManager.titles.upsertTitle({
            anilistId: 1,
            titleRomaji: 'Initial Title',
            genres: ['Action', 'Comedy'],
        });
        await animeManager.titles.upsertTitle({
            anilistId: 1,
            titleRomaji: 'Updated Title',
            genres: ['Drama'],
        });

        const title = await animeManager.titles.getOnePlain({ anilistId: 1 });

        expect(title?.titleRomaji).toBe('Updated Title');
        expect(animeManager.titles.parseGenres(title ?? {})).toEqual(['Drama']);
        expect(animeManager.titles.parseGenres({ genresJson: JSON.stringify(['Action', 42, 'Comedy']) })).toEqual(['Action', 'Comedy']);
        expect(animeManager.titles.parseGenres({ genresJson: JSON.stringify({ genre: 'Action' }) })).toEqual([]);
        expect(animeManager.titles.parseGenres({ genresJson: 'not-json' })).toEqual([]);
        expect(animeManager.titles.parseGenres({ genresJson: null })).toEqual([]);
    });

    it('creates and updates user subscriptions', async () => {
        const created = await animeManager.subscriptions.subscribeUser({
            anilistId: 1,
            userId: 'user-1',
        });
        const updated = await animeManager.subscriptions.subscribeUser({
            anilistId: 1,
            userId: 'user-1',
            reminderMinutes: 45,
        });

        const subscriptions = await animeManager.subscriptions.getUserSubscriptions('user-1');

        expect(created).toBe(true);
        expect(updated).toBe(false);
        expect(subscriptions).toHaveLength(1);
        expect(subscriptions[0].targetType).toBe('dm');
        expect(subscriptions[0].reminderMinutes).toBe(45);
        expect(Boolean(subscriptions[0].paused)).toBe(false);
    });

    it('creates, updates, queries, and removes channel subscriptions', async () => {
        const created = await animeManager.subscriptions.subscribeChannel({
            anilistId: 2,
            guildId: 'guild-1',
            channelId: 'channel-1',
            reminderMinutes: 10,
        });
        const updated = await animeManager.subscriptions.subscribeChannel({
            anilistId: 2,
            guildId: 'guild-1',
            channelId: 'channel-1',
        });

        const subscriptions = await animeManager.subscriptions.getGuildChannelSubscriptions('guild-1');
        const deleted = await animeManager.subscriptions.unsubscribeChannel({
            anilistId: 2,
            guildId: 'guild-1',
            channelId: 'channel-1',
        });

        expect(created).toBe(true);
        expect(updated).toBe(false);
        expect(subscriptions).toHaveLength(1);
        expect(subscriptions[0].targetType).toBe('channel');
        expect(subscriptions[0].reminderMinutes).toBe(10);
        expect(deleted).toBe(1);
    });

    it('pauses and resumes subscriptions', async () => {
        await animeManager.subscriptions.subscribeUser({
            anilistId: 4,
            userId: 'user-3',
            reminderMinutes: 30,
        });
        const [subscription] = await animeManager.subscriptions.getUserSubscriptions('user-3');

        await animeManager.subscriptions.setPaused(subscription.id!, true);
        const paused = await animeManager.subscriptions.findByPkPlain(subscription.id!);
        await animeManager.subscriptions.setPaused(subscription.id!, false);
        const resumed = await animeManager.subscriptions.findByPkPlain(subscription.id!);

        expect(Boolean(paused.paused)).toBe(true);
        expect(Boolean(resumed.paused)).toBe(false);
    });

    it('removes user subscriptions and upserts episode records', async () => {
        await animeManager.subscriptions.subscribeUser({
            anilistId: 3,
            userId: 'user-2',
            reminderMinutes: 30,
        });
        const deleted = await animeManager.subscriptions.unsubscribeUser({
            anilistId: 3,
            userId: 'user-2',
        });

        await animeManager.episodes.upsertEpisode({ anilistId: 3, episode: 1, airingAt: 1000 });
        await animeManager.episodes.upsertEpisode({ anilistId: 3, episode: 1, airingAt: 2000 });
        const episodes = await animeManager.episodes.getManyPlain({ anilistId: 3 });

        expect(deleted).toBe(1);
        expect(await AnimeSubscriptionConfig.count()).toBe(0);
        expect(episodes).toHaveLength(1);
        expect(episodes[0].airingAt).toBe(2000);
    });
});
