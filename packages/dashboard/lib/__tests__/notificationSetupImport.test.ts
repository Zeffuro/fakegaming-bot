import { describe, expect, it } from 'vitest';
import {
    buildNotificationSetupImportCreatePayload,
    buildNotificationSetupImportPlan,
    parseNotificationSetupImportJson,
} from '@/lib/notificationSetupImport';
import type { NotificationSetupExport } from '@/lib/notificationSetupExport';

const baseExport: NotificationSetupExport = {
    version: 1,
    guildId: 'source-guild',
    exportedAt: '2026-06-22T00:00:00.000Z',
    totals: {
        records: 0,
        duplicateRoutes: 0,
        multiChannelFeeds: 0,
        busyChannels: 0,
    },
    records: [],
    review: {
        duplicateRoutes: [],
        multiChannelFeeds: [],
        busyChannels: [],
    },
};

describe('notification setup import', () => {
    it('parses version 1 export JSON and rejects unsupported shapes', () => {
        expect(parseNotificationSetupImportJson(JSON.stringify(baseExport))).toMatchObject({
            version: 1,
            guildId: 'source-guild',
        });

        expect(() => parseNotificationSetupImportJson('{')).toThrow('Import file is not valid JSON.');
        expect(() => parseNotificationSetupImportJson(JSON.stringify({ version: 2, guildId: 'guild', records: [] })))
            .toThrow('Only notification setup export version 1 is supported.');
        expect(() => parseNotificationSetupImportJson(JSON.stringify({ version: 1, guildId: 'guild' })))
            .toThrow('Import file is missing notification records.');
    });

    it('builds a safe import plan with duplicates, unsupported records, and guild warnings', () => {
        const plan = buildNotificationSetupImportPlan({
            exportPayload: {
                ...baseExport,
                records: [
                    { provider: 'Twitch', source: 'StreamerOne', sourceId: 'StreamerOne', channelId: 'channel-1' },
                    { provider: 'Twitch', source: 'StreamerTwo', sourceId: 'StreamerTwo', channelId: 'channel-2' },
                    { provider: 'Anime', source: 'Show', sourceId: '123', channelId: 'channel-3', reminderMinutes: 20 },
                    { provider: 'Steam News', source: 'Counter-Strike 2', sourceId: '730', channelId: 'channel-5' },
                    { provider: 'Mastodon', source: 'example', sourceId: 'example', channelId: 'channel-6' },
                    { provider: 'YouTube', source: 'Video Archive', channelId: 'channel-4' },
                ],
            },
            currentGuildId: 'target-guild',
            currentRecords: [
                { provider: 'Twitch', source: 'streamerone', sourceId: 'streamerone', channelId: 'channel-1' },
            ],
        });

        expect(plan.warnings).toEqual([
            'This export came from guild source-guild; imports will be created in guild target-guild.',
        ]);
        expect(plan.ready.map((item) => item.record.source)).toEqual(['StreamerTwo', 'Show', 'Counter-Strike 2']);
        expect(plan.totals).toEqual({
            records: 6,
            ready: 3,
            duplicate: 1,
            unsupported: 1,
            invalid: 1,
        });
        expect(plan.skipped.map((item) => item.reason)).toEqual(['duplicate', 'unsupported', 'invalid']);
    });

    it('treats duplicate routes inside the imported file as skipped', () => {
        const plan = buildNotificationSetupImportPlan({
            exportPayload: {
                ...baseExport,
                records: [
                    { provider: 'Bluesky', source: '@example.test', sourceId: '@example.test', channelId: 'channel-1' },
                    { provider: 'Bluesky', source: 'example.test', sourceId: '@example.test', channelId: 'channel-1' },
                ],
            },
            currentGuildId: 'source-guild',
            currentRecords: [],
        });

        expect(plan.ready).toHaveLength(1);
        expect(plan.skipped).toHaveLength(1);
        expect(plan.skipped[0]?.reason).toBe('duplicate');
    });

    it('treats existing birthdays as duplicates by user even when the channel changed', () => {
        const plan = buildNotificationSetupImportPlan({
            exportPayload: {
                ...baseExport,
                records: [
                    {
                        provider: 'Birthdays',
                        source: 'user-1',
                        sourceId: 'user-1',
                        channelId: 'new-channel',
                        birthday: { day: 29, month: 2 },
                    },
                    {
                        provider: 'Birthdays',
                        source: 'user-2',
                        sourceId: 'user-2',
                        channelId: 'channel-2',
                    },
                ],
            },
            currentGuildId: 'source-guild',
            currentRecords: [
                {
                    provider: 'Birthdays',
                    source: 'user-1',
                    sourceId: 'user-1',
                    channelId: 'old-channel',
                    birthday: { day: 29, month: 2 },
                },
            ],
        });

        expect(plan.ready).toHaveLength(0);
        expect(plan.skipped.map((item) => item.reason)).toEqual(['duplicate', 'invalid']);
    });

    it('builds provider-specific create payloads', () => {
        expect(buildNotificationSetupImportCreatePayload('guild-1', {
            provider: 'Twitch',
            source: 'Streamer',
            sourceId: 'Streamer',
            channelId: 'channel-1',
            paused: true,
            customMessage: 'Live now',
            cooldownMinutes: 15,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
        })).toEqual({
            provider: 'Twitch',
            payload: {
                twitchUsername: 'Streamer',
                discordChannelId: 'channel-1',
                guildId: 'guild-1',
                paused: true,
                customMessage: 'Live now',
                cooldownMinutes: 15,
                quietHoursStart: '22:00',
                quietHoursEnd: '07:00',
            },
        });

        expect(buildNotificationSetupImportCreatePayload('guild-1', {
            provider: 'Patch Notes',
            source: 'League of Legends',
            sourceId: 'League of Legends',
            channelId: 'channel-2',
            paused: true,
            customMessage: 'Ignored by patch notes',
        })).toEqual({
            provider: 'Patch Notes',
            payload: {
                game: 'League of Legends',
                channelId: 'channel-2',
                guildId: 'guild-1',
                paused: true,
            },
        });

        expect(buildNotificationSetupImportCreatePayload('guild-1', {
            provider: 'Steam News',
            source: 'Counter-Strike 2',
            sourceId: '730',
            channelId: 'channel-6',
            paused: true,
            customMessage: 'Game news',
            cooldownMinutes: 30,
        })).toEqual({
            provider: 'Steam News',
            payload: {
                steamAppId: 730,
                appName: 'Counter-Strike 2',
                discordChannelId: 'channel-6',
                guildId: 'guild-1',
                paused: true,
                customMessage: 'Game news',
                cooldownMinutes: 30,
                quietHoursStart: null,
                quietHoursEnd: null,
            },
        });

        expect(buildNotificationSetupImportCreatePayload('guild-1', {
            provider: 'Bluesky',
            source: '@example.test',
            sourceId: '@example.test',
            channelId: 'channel-3',
        })).toMatchObject({
            provider: 'Bluesky',
            payload: {
                blueskyHandle: 'example.test',
                discordChannelId: 'channel-3',
            },
        });

        expect(buildNotificationSetupImportCreatePayload('guild-1', {
            provider: 'Anime',
            source: 'Airing Show',
            sourceId: '123',
            channelId: 'channel-4',
            reminderMinutes: 45,
        })).toEqual({
            provider: 'Anime',
            payload: {
                anilistId: 123,
                channelId: 'channel-4',
                guildId: 'guild-1',
                reminderMinutes: 45,
            },
        });

        expect(buildNotificationSetupImportCreatePayload('guild-1', {
            provider: 'Birthdays',
            source: 'user-1',
            sourceId: 'user-1',
            channelId: 'channel-5',
            birthday: {
                day: 22,
                month: 6,
                year: 1994,
            },
        })).toEqual({
            provider: 'Birthdays',
            payload: {
                userId: 'user-1',
                channelId: 'channel-5',
                guildId: 'guild-1',
                day: 22,
                month: 6,
                year: 1994,
            },
        });
    });
});
