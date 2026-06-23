import { describe, expect, it } from 'vitest';
import { combineAnimeSubscriptions } from '@/lib/animeSubscriptionFilters';
import { findDuplicateAnimeSubscriptionGroups, getDuplicateAnimeSubscriptionsToRemove } from '@/lib/animeSubscriptionReview';
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
        ...overrides,
    };
}

describe('animeSubscriptionReview', () => {
    it('groups server duplicates by AniList ID and destination channel', () => {
        const groups = findDuplicateAnimeSubscriptionGroups(combineAnimeSubscriptions([
            subscription({ id: 1, anilistId: 101, animeTitle: 'Same Show', discordChannelId: 'channel-1' }),
            subscription({ id: 2, anilistId: 101, animeTitle: 'Same Show', channelId: 'channel-1', discordChannelId: 'channel-1' }),
            subscription({ id: 3, anilistId: 101, animeTitle: 'Same Show', discordChannelId: 'channel-2' }),
        ], []));

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            scope: 'server',
            anilistId: 101,
            destinationId: 'channel-1',
            count: 2,
        });
        expect(groups[0]?.subscriptions.map((item) => item.config.id)).toEqual([1, 2]);
    });

    it('groups current-user personal duplicates by DM destination', () => {
        const groups = findDuplicateAnimeSubscriptionGroups(combineAnimeSubscriptions([], [
            subscription({ id: 1, anilistId: 201, animeTitle: 'DM Show', discordChannelId: 'dm' }),
            subscription({ id: 2, anilistId: 201, animeTitle: 'DM Show', discordChannelId: 'dm' }),
        ]));

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            scope: 'personal',
            anilistId: 201,
            destinationId: 'dm',
            count: 2,
        });
    });

    it('does not group the same title across different scopes or destinations', () => {
        const groups = findDuplicateAnimeSubscriptionGroups(combineAnimeSubscriptions([
            subscription({ id: 1, anilistId: 301, animeTitle: 'Shared Show', discordChannelId: 'channel-1' }),
            subscription({ id: 2, anilistId: 301, animeTitle: 'Shared Show', discordChannelId: 'channel-2' }),
        ], [
            subscription({ id: 3, anilistId: 301, animeTitle: 'Shared Show', discordChannelId: 'dm' }),
        ]));

        expect(groups).toEqual([]);
    });

    it('sorts duplicate groups by size and applies the limit', () => {
        const groups = findDuplicateAnimeSubscriptionGroups(combineAnimeSubscriptions([
            subscription({ id: 1, anilistId: 401, animeTitle: 'Two Count', discordChannelId: 'channel-1' }),
            subscription({ id: 2, anilistId: 401, animeTitle: 'Two Count', discordChannelId: 'channel-1' }),
            subscription({ id: 3, anilistId: 402, animeTitle: 'Three Count', discordChannelId: 'channel-2' }),
            subscription({ id: 4, anilistId: 402, animeTitle: 'Three Count', discordChannelId: 'channel-2' }),
            subscription({ id: 5, anilistId: 402, animeTitle: 'Three Count', discordChannelId: 'channel-2' }),
        ], []), 1);

        expect(groups.map((group) => group.title)).toEqual(['Three Count']);
        expect(groups[0]?.count).toBe(3);
    });

    it('returns all duplicate subscriptions except the first sorted keeper', () => {
        const groups = findDuplicateAnimeSubscriptionGroups(combineAnimeSubscriptions([
            subscription({ id: 3, anilistId: 501, animeTitle: 'Cleanup Show', discordChannelId: 'channel-1' }),
            subscription({ id: 1, anilistId: 501, animeTitle: 'Cleanup Show', discordChannelId: 'channel-1' }),
            subscription({ id: 2, anilistId: 501, animeTitle: 'Cleanup Show', discordChannelId: 'channel-1' }),
        ], []));

        expect(groups[0]?.subscriptions.map((item) => item.config.id)).toEqual([1, 2, 3]);
        expect(groups[0] ? getDuplicateAnimeSubscriptionsToRemove(groups[0]).map((item) => item.config.id) : []).toEqual([2, 3]);
    });
});
