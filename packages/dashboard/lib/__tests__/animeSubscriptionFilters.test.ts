import { describe, expect, it } from 'vitest';
import {
    combineAnimeSubscriptions,
    filterAnimeSubscriptions,
    type FilterableAnimeSubscription,
} from '@/lib/animeSubscriptionFilters';
import type { AnimeSubscriptionDashboardConfig } from '@/lib/api-client';

function subscription(overrides: Partial<AnimeSubscriptionDashboardConfig>): AnimeSubscriptionDashboardConfig {
    return {
        id: 1,
        anilistId: 100,
        animeTitle: 'Airing Show',
        discordChannelId: 'channel-1',
        guildId: 'guild-1',
        reminderMinutes: 30,
        paused: false,
        status: 'RELEASING',
        format: 'TV',
        nextEpisode: 4,
        nextAiringAt: 1782200000000,
        ...overrides,
    };
}

const subscriptions: FilterableAnimeSubscription[] = [
    { scope: 'server', config: subscription({ id: 1, anilistId: 101, animeTitle: 'Alpha Show', discordChannelId: 'channel-alpha' }) },
    { scope: 'server', config: subscription({ id: 2, anilistId: 102, animeTitle: 'Paused Show', discordChannelId: 'channel-beta', paused: true }) },
    { scope: 'personal', config: subscription({ id: 3, anilistId: 103, animeTitle: 'Missing Airing', discordChannelId: 'dm', nextAiringAt: null, status: 'FINISHED' }) },
];

describe('animeSubscriptionFilters', () => {
    it('combines server and personal subscriptions with scope metadata', () => {
        const combined = combineAnimeSubscriptions(
            [subscription({ id: 1, animeTitle: 'Server Show' })],
            [subscription({ id: 2, animeTitle: 'DM Show' })],
        );

        expect(combined.map((item) => `${item.scope}:${item.config.animeTitle}`)).toEqual([
            'server:Server Show',
            'personal:DM Show',
        ]);
    });

    it('filters by normalized title, AniList ID, status, and scope text', () => {
        expect(filterAnimeSubscriptions(subscriptions, { query: 'alpha   show' }).map((item) => item.config.id)).toEqual([1]);
        expect(filterAnimeSubscriptions(subscriptions, { query: '102' }).map((item) => item.config.id)).toEqual([2]);
        expect(filterAnimeSubscriptions(subscriptions, { query: 'finished' }).map((item) => item.config.id)).toEqual([3]);
        expect(filterAnimeSubscriptions(subscriptions, { query: 'personal' }).map((item) => item.config.id)).toEqual([3]);
    });

    it('filters by channel names', () => {
        const result = filterAnimeSubscriptions(subscriptions, {
            query: 'announcements',
            channelNames: {
                'channel-alpha': '#announcements',
                'channel-beta': '#clips',
            },
        });

        expect(result.map((item) => item.config.id)).toEqual([1]);
    });

    it('filters by active, paused, known-airing, and missing-airing status', () => {
        expect(filterAnimeSubscriptions(subscriptions, { status: 'active' }).map((item) => item.config.id)).toEqual([1, 3]);
        expect(filterAnimeSubscriptions(subscriptions, { status: 'paused' }).map((item) => item.config.id)).toEqual([2]);
        expect(filterAnimeSubscriptions(subscriptions, { status: 'airing-known' }).map((item) => item.config.id)).toEqual([1, 2]);
        expect(filterAnimeSubscriptions(subscriptions, { status: 'airing-missing' }).map((item) => item.config.id)).toEqual([3]);
    });
});
