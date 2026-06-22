import { describe, expect, it } from 'vitest';
import { buildNotificationSetupExport, buildNotificationSetupExportFilename } from '@/lib/notificationSetupExport';
import { buildNotificationSetupReview } from '@/lib/notificationSetupReview';

function emptyInput() {
    return {
        twitch: [],
        youtube: [],
        tiktok: [],
        bluesky: [],
        steamNews: [],
        patchNotes: [],
        anime: [],
        birthdays: [],
    };
}

describe('notification setup export', () => {
    it('builds a stable read-only export payload', () => {
        const input = {
            ...emptyInput(),
            twitch: [
                {
                    id: 1,
                    twitchUsername: 'Streamer',
                    discordChannelId: 'channel-1',
                    paused: true,
                    customMessage: 'Live now',
                    cooldownMinutes: 15,
                    quietHoursStart: '22:00',
                    quietHoursEnd: '07:00',
                },
            ],
            patchNotes: [
                {
                    id: 2,
                    game: 'League of Legends',
                    discordChannelId: 'channel-2',
                },
            ],
            steamNews: [
                {
                    id: 5,
                    steamAppId: 730,
                    appName: 'Counter-Strike 2',
                    discordChannelId: 'channel-5',
                    paused: false,
                    customMessage: 'Game news',
                },
            ],
            anime: [
                {
                    id: 3,
                    anilistId: 123,
                    animeTitle: 'Airing Show',
                    discordChannelId: 'channel-3',
                    reminderMinutes: 45,
                },
            ],
            birthdays: [
                {
                    userId: 'user-1',
                    channelId: 'channel-4',
                    day: 22,
                    month: 6,
                    year: 1994,
                },
            ],
        };
        const review = buildNotificationSetupReview(input);

        expect(buildNotificationSetupExport({
            guildId: 'guild-1',
            exportedAt: '2026-06-22T00:00:00.000Z',
            review,
            ...input,
        })).toMatchObject({
            version: 1,
            guildId: 'guild-1',
            exportedAt: '2026-06-22T00:00:00.000Z',
            totals: {
                records: 5,
                duplicateRoutes: 0,
                multiChannelFeeds: 0,
                busyChannels: 0,
            },
            records: [
                {
                    provider: 'Twitch',
                    id: 1,
                    source: 'Streamer',
                    sourceId: 'Streamer',
                    channelId: 'channel-1',
                    paused: true,
                    customMessage: 'Live now',
                    cooldownMinutes: 15,
                    quietHoursStart: '22:00',
                    quietHoursEnd: '07:00',
                },
                {
                    provider: 'Steam News',
                    id: 5,
                    source: 'Counter-Strike 2',
                    sourceId: '730',
                    channelId: 'channel-5',
                    paused: false,
                    customMessage: 'Game news',
                },
                {
                    provider: 'Patch Notes',
                    id: 2,
                    source: 'League of Legends',
                    sourceId: 'League of Legends',
                    channelId: 'channel-2',
                },
                {
                    provider: 'Anime',
                    id: 3,
                    source: 'Airing Show',
                    sourceId: '123',
                    channelId: 'channel-3',
                    reminderMinutes: 45,
                },
                {
                    provider: 'Birthdays',
                    source: 'user-1',
                    sourceId: 'user-1',
                    channelId: 'channel-4',
                    birthday: {
                        day: 22,
                        month: 6,
                        year: 1994,
                    },
                },
            ],
        });
    });

    it('keeps YouTube channel identity separate from display labels for restore workflows', () => {
        const input = {
            ...emptyInput(),
            youtube: [
                {
                    id: 3,
                    youtubeChannelId: 'UC1234567890123456789012',
                    youtubeChannelTitle: 'Video Archive',
                    discordChannelId: 'channel-3',
                },
            ],
        };
        const review = buildNotificationSetupReview(input);

        expect(buildNotificationSetupExport({
            guildId: 'guild-1',
            exportedAt: '2026-06-22T00:00:00.000Z',
            review,
            ...input,
        }).records[0]).toMatchObject({
            provider: 'YouTube',
            source: 'Video Archive',
            sourceId: 'UC1234567890123456789012',
            channelId: 'channel-3',
        });
    });

    it('sanitizes export filenames', () => {
        expect(buildNotificationSetupExportFilename('guild:../weird', new Date('2026-06-22T12:00:00.000Z')))
            .toBe('notification-setup-guild----weird-2026-06-22.json');
    });
});
