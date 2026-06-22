import { describe, expect, it } from 'vitest';
import {
    buildNotificationChannelLinks,
    buildNotificationProviderFilterHref,
    buildNotificationReviewGroupLink,
} from '@/lib/notificationSetupLinks';

describe('notification setup links', () => {
    it('builds encoded provider filter links', () => {
        expect(buildNotificationProviderFilterHref('guild 1', 'Twitch', 'Streamer One')).toBe('/dashboard/twitch/guild%201?q=Streamer+One');
        expect(buildNotificationProviderFilterHref('guild/2', 'Patch Notes', 'League of Legends', 'paused')).toBe('/dashboard/patch-notes/guild%2F2?q=League+of+Legends&status=paused');
    });

    it('returns null for providers without shared filtered config pages', () => {
        expect(buildNotificationProviderFilterHref('guild-1', 'Anime', 'Show')).toBeNull();
        expect(buildNotificationReviewGroupLink('guild-1', {
            provider: 'Birthdays',
            sourceLabel: '123',
        })).toBeNull();
    });

    it('builds group links from provider and source labels', () => {
        expect(buildNotificationReviewGroupLink('guild-1', {
            provider: 'YouTube',
            sourceLabel: 'Video Archive',
        })).toEqual({
            label: 'Open YouTube',
            href: '/dashboard/youtube/guild-1?q=Video+Archive',
        });
    });

    it('builds busy channel links only for supported providers', () => {
        expect(buildNotificationChannelLinks('guild-1', {
            channelId: 'channel-live',
            providers: ['Anime', 'Bluesky', 'Twitch'],
        })).toEqual([
            {
                label: 'Bluesky',
                href: '/dashboard/bluesky/guild-1?q=channel-live',
            },
            {
                label: 'Twitch',
                href: '/dashboard/twitch/guild-1?q=channel-live',
            },
        ]);
    });
});
