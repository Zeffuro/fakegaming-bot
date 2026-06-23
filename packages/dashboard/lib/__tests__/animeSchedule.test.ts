import { describe, expect, it } from 'vitest';
import { buildAnimeAiringSchedule } from '@/lib/animeSchedule';
import type { AnimeSubscriptionDashboardConfig } from '@/lib/api-client';

const now = Date.UTC(2026, 5, 23, 10, 0, 0);

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

describe('animeSchedule', () => {
    it('builds an airing schedule from server and personal subscriptions', () => {
        const result = buildAnimeAiringSchedule(
            [
                subscription({ id: 1, animeTitle: 'Soon', nextAiringAt: now + 60 * 60 * 1000, nextEpisode: 3 }),
                subscription({ id: 2, animeTitle: 'Paused', nextAiringAt: now + 2 * 60 * 60 * 1000, paused: true }),
                subscription({ id: 3, animeTitle: 'Unknown', nextAiringAt: null }),
            ],
            [
                subscription({ id: 4, animeTitle: 'Personal', nextAiringAt: now + 3 * 60 * 60 * 1000, discordChannelId: 'dm', targetType: 'dm' }),
            ],
            now,
        );

        expect(result.summary).toMatchObject({
            totalSubscriptions: 4,
            activeSubscriptions: 3,
            pausedSubscriptions: 1,
            scheduledSubscriptions: 3,
            unscheduledSubscriptions: 1,
            dueWithin24Hours: 2,
            dueNow: 0,
        });
        expect(result.summary.nextItem?.subscription.animeTitle).toBe('Soon');
        expect(result.items.map((item) => `${item.scope}:${item.subscription.animeTitle}:${item.status}`)).toEqual([
            'server:Soon:upcoming',
            'server:Paused:paused',
            'personal:Personal:upcoming',
        ]);
    });

    it('marks active reminders as due now after their reminder time passes', () => {
        const result = buildAnimeAiringSchedule(
            [subscription({ nextAiringAt: now + 10 * 60 * 1000, reminderMinutes: 30 })],
            [],
            now,
        );

        expect(result.items[0]?.status).toBe('due-now');
        expect(result.summary.dueNow).toBe(1);
        expect(result.summary.dueWithin24Hours).toBe(0);
    });

    it('normalizes second-based airing timestamps', () => {
        const result = buildAnimeAiringSchedule(
            [subscription({ nextAiringAt: Math.floor((now + 60 * 60 * 1000) / 1000) })],
            [],
            now,
        );

        expect(result.items[0]?.airingAt).toBe(now + 60 * 60 * 1000);
    });

    it('limits sorted schedule items without changing summary counts', () => {
        const result = buildAnimeAiringSchedule(
            [
                subscription({ id: 3, animeTitle: 'Third', nextAiringAt: now + 3 }),
                subscription({ id: 1, animeTitle: 'First', nextAiringAt: now + 1 }),
                subscription({ id: 2, animeTitle: 'Second', nextAiringAt: now + 2 }),
            ],
            [],
            now,
            2,
        );

        expect(result.items.map((item) => item.subscription.animeTitle)).toEqual(['First', 'Second']);
        expect(result.summary.scheduledSubscriptions).toBe(3);
    });
});
