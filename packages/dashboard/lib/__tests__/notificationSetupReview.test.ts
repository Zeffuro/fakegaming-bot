import { describe, expect, it } from 'vitest';
import { buildNotificationSetupReview } from '@/lib/notificationSetupReview';

function emptyInput() {
    return {
        twitch: [],
        youtube: [],
        tiktok: [],
        bluesky: [],
        patchNotes: [],
        anime: [],
        birthdays: [],
    };
}

describe('buildNotificationSetupReview', () => {
    it('detects duplicate routes and same-feed multi-channel overlap', () => {
        const review = buildNotificationSetupReview({
            ...emptyInput(),
            twitch: [
                { twitchUsername: 'StreamerOne', discordChannelId: 'channel-1' },
                { twitchUsername: 'streamerone', discordChannelId: 'channel-1' },
                { twitchUsername: 'StreamerOne', discordChannelId: 'channel-2' },
            ],
        });

        expect(review.duplicateRoutes).toHaveLength(1);
        expect(review.duplicateRoutes[0]).toMatchObject({
            provider: 'Twitch',
            sourceLabel: 'StreamerOne',
            channelIds: ['channel-1'],
        });
        expect(review.duplicateRoutes[0]?.records).toHaveLength(2);

        expect(review.multiChannelFeeds).toHaveLength(1);
        expect(review.multiChannelFeeds[0]).toMatchObject({
            provider: 'Twitch',
            sourceLabel: 'StreamerOne',
            channelIds: ['channel-1', 'channel-2'],
        });
        expect(review.multiChannelFeeds[0]?.records).toHaveLength(3);
    });

    it('detects busy destination channels across providers', () => {
        const review = buildNotificationSetupReview({
            ...emptyInput(),
            twitch: [{ twitchUsername: 'a', discordChannelId: 'channel-busy' }],
            youtube: [{ youtubeChannelId: 'b', discordChannelId: 'channel-busy' }],
            tiktok: [{ tiktokUsername: 'c', discordChannelId: 'channel-busy' }],
            bluesky: [{ blueskyHandle: 'd.test', discordChannelId: 'channel-busy' }],
            patchNotes: [{ game: 'Game', discordChannelId: 'channel-busy' }],
        });

        expect(review.busyChannels).toEqual([
            {
                channelId: 'channel-busy',
                count: 5,
                providers: ['Bluesky', 'Patch Notes', 'TikTok', 'Twitch', 'YouTube'],
            },
        ]);
    });
});
