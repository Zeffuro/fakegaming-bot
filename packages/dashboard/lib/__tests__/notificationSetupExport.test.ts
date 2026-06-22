import { describe, expect, it } from 'vitest';
import { buildNotificationSetupExport, buildNotificationSetupExportFilename } from '@/lib/notificationSetupExport';
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
                records: 2,
                duplicateRoutes: 0,
                multiChannelFeeds: 0,
                busyChannels: 0,
            },
            records: [
                {
                    provider: 'Twitch',
                    id: 1,
                    source: 'Streamer',
                    channelId: 'channel-1',
                    paused: true,
                    customMessage: 'Live now',
                    cooldownMinutes: 15,
                    quietHoursStart: '22:00',
                    quietHoursEnd: '07:00',
                },
                {
                    provider: 'Patch Notes',
                    id: 2,
                    source: 'League of Legends',
                    channelId: 'channel-2',
                },
            ],
        });
    });

    it('sanitizes export filenames', () => {
        expect(buildNotificationSetupExportFilename('guild:../weird', new Date('2026-06-22T12:00:00.000Z')))
            .toBe('notification-setup-guild----weird-2026-06-22.json');
    });
});
