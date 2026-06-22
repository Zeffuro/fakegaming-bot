import { describe, expect, it } from 'vitest';
import {
    animeSubscribeRequestSchema,
    apiRequestSchemas,
    birthdayCreateRequestSchema,
    blueskyCreateRequestSchema,
    blueskyUpdateRequestSchema,
    discordResolveUsersRequestSchema,
    jobRunRequestSchema,
    patchSubscriptionRequestSchema,
    quoteCreateRequestSchema,
    reminderCreateRequestSchema,
    riotLinkUpdateRequestSchema,
    serverUpdateRequestSchema,
    steamNewsSubscriptionRequestSchema,
    tiktokCreateRequestSchema,
    twitchCreateRequestSchema,
    twitchUpdateRequestSchema,
    userUpdateRequestSchema,
    youtubeChannelRequestSchema,
    youtubeCreateRequestSchema,
    youtubeUpdateRequestSchema,
} from '../schemas.js';

describe('api request schemas', () => {
    it('exports every schema used for OpenAPI request components', () => {
        expect(Object.keys(apiRequestSchemas).sort()).toEqual([
            'AnimeSubscribeRequest',
            'AuthLoginRequest',
            'BirthdayCreateRequest',
            'BirthdayUpdateRequest',
            'BlueskyCreateRequest',
            'BlueskyUpdateRequest',
            'DisabledCommandCreateRequest',
            'DisabledModuleCreateRequest',
            'DiscordResolveUsersRequest',
            'JobRunRequest',
            'PatchNoteCreateRequest',
            'PatchSubscriptionRequest',
            'PausedStateRequest',
            'QuoteCreateRequest',
            'ReminderCreateRequest',
            'RiotLinkUpdateRequest',
            'ServerCreateRequest',
            'ServerUpdateRequest',
            'SteamNewsSubscriptionRequest',
            'TikTokCreateRequest',
            'TikTokUpdateRequest',
            'TwitchCreateRequest',
            'TwitchUpdateRequest',
            'UserCreateRequest',
            'UserDefaultReminderTimeSpanUpdateRequest',
            'UserTimezoneUpdateRequest',
            'UserUpdateRequest',
            'YoutubeChannelRequest',
            'YoutubeCreateRequest',
            'YoutubeUpdateRequest',
        ]);
    });

    it('accepts representative valid request bodies', () => {
        expect(twitchCreateRequestSchema.parse(streamCreateBody('twitchUsername'))).toMatchObject({ twitchUsername: 'creator' });
        expect(tiktokCreateRequestSchema.parse(streamCreateBody('tiktokUsername'))).toMatchObject({ tiktokUsername: 'creator' });
        expect(blueskyCreateRequestSchema.parse(streamCreateBody('blueskyHandle'))).toMatchObject({ blueskyHandle: 'creator' });
        expect(youtubeCreateRequestSchema.parse(streamCreateBody('youtubeChannelId'))).toMatchObject({ youtubeChannelId: 'creator' });
        expect(youtubeChannelRequestSchema.parse({
            youtubeChannelId: 'UC123',
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
        })).toMatchObject({ youtubeChannelId: 'UC123' });
        expect(patchSubscriptionRequestSchema.parse({
            game: 'Overwatch',
            channelId: 'channel-1',
            guildId: 'guild-1',
            paused: true,
        })).toMatchObject({ game: 'Overwatch' });
        expect(steamNewsSubscriptionRequestSchema.parse({
            steamAppId: '730',
            appName: 'Counter-Strike 2',
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
            paused: true,
        })).toMatchObject({ steamAppId: 730 });
        expect(quoteCreateRequestSchema.parse({
            guildId: 'guild-1',
            quote: 'hello',
            authorId: 'author-1',
            timestamp: 123,
        })).toMatchObject({ quote: 'hello' });
        expect(reminderCreateRequestSchema.parse({
            id: 'reminder-1',
            userId: 'user-1',
            message: 'ping',
            timespan: '1h',
            timestamp: 123,
        })).toMatchObject({ message: 'ping' });
        expect(riotLinkUpdateRequestSchema.parse({
            summonerName: 'Zeffuro#EUW',
            riotIdGameName: 'Zeffuro',
            riotIdTagLine: 'EUW',
            region: 'EUW',
            puuid: 'puuid-1',
        })).toMatchObject({ region: 'EUW' });
    });

    it('rejects unknown fields on strict request DTOs', () => {
        expect(() => patchSubscriptionRequestSchema.parse({
            game: 'Overwatch',
            channelId: 'channel-1',
            guildId: 'guild-1',
            lastAnnouncedAt: 123,
        })).toThrow();
    });

    it('validates body-level refinements', () => {
        expect(animeSubscribeRequestSchema.parse({
            title: 'Frieren',
            guildId: 'guild-1',
            channelId: 'channel-1',
        })).toMatchObject({ title: 'Frieren' });
        expect(animeSubscribeRequestSchema.parse({
            anilistId: 123,
            guildId: 'guild-1',
            channelId: 'channel-1',
        })).toMatchObject({ anilistId: 123 });
        expect(() => animeSubscribeRequestSchema.parse({
            guildId: 'guild-1',
            channelId: 'channel-1',
        })).toThrow();

        expect(birthdayCreateRequestSchema.parse({
            userId: 'user-1',
            guildId: 'guild-1',
            channelId: 'channel-1',
            day: 29,
            month: 2,
            year: 2024,
        })).toMatchObject({ day: 29 });
        expect(birthdayCreateRequestSchema.parse({
            userId: 'user-1',
            guildId: 'guild-1',
            channelId: 'channel-1',
            day: 29,
            month: 2,
        })).toMatchObject({ month: 2 });
        expect(() => birthdayCreateRequestSchema.parse({
            userId: 'user-1',
            guildId: 'guild-1',
            channelId: 'channel-1',
            day: 31,
            month: 2,
            year: 2025,
        })).toThrow();
    });

    it('validates optional notification controls', () => {
        expect(twitchCreateRequestSchema.parse({
            ...streamCreateBody('twitchUsername'),
            quietHoursStart: '08:00',
            quietHoursEnd: '23:59',
            cooldownMinutes: null,
        })).toMatchObject({ quietHoursStart: '08:00' });

        expect(() => twitchCreateRequestSchema.parse({
            ...streamCreateBody('twitchUsername'),
            quietHoursStart: '25:00',
        })).toThrow();
    });

    it('requires at least one field for update request bodies', () => {
        expect(twitchUpdateRequestSchema.parse({ customMessage: 'Live now' })).toMatchObject({ customMessage: 'Live now' });
        expect(blueskyUpdateRequestSchema.parse({ blueskyHandle: 'new.handle' })).toMatchObject({ blueskyHandle: 'new.handle' });
        expect(youtubeUpdateRequestSchema.parse({ cooldownMinutes: 10 })).toMatchObject({ cooldownMinutes: 10 });
        expect(serverUpdateRequestSchema.parse({ prefix: '!' })).toMatchObject({ prefix: '!' });
        expect(userUpdateRequestSchema.parse({ timezone: 'Europe/Amsterdam' })).toMatchObject({ timezone: 'Europe/Amsterdam' });

        expect(() => twitchUpdateRequestSchema.parse({})).toThrow();
        expect(() => youtubeUpdateRequestSchema.parse({})).toThrow();
        expect(() => userUpdateRequestSchema.parse({})).toThrow();
    });

    it('validates job and Discord helper requests', () => {
        expect(jobRunRequestSchema.parse({ date: '2026-06-11T10:00:00.000Z', force: true })).toMatchObject({ force: true });
        expect(() => jobRunRequestSchema.parse({ date: 'not-a-date' })).toThrow();

        expect(discordResolveUsersRequestSchema.parse({
            guildId: 'guild-1',
            ids: ['1', '2'],
        })).toMatchObject({ ids: ['1', '2'] });
        expect(() => discordResolveUsersRequestSchema.parse({
            guildId: 'guild-1',
            ids: Array.from({ length: 51 }, (_, index) => String(index)),
        })).toThrow();
    });
});

function streamCreateBody(nameField: 'blueskyHandle' | 'tiktokUsername' | 'twitchUsername' | 'youtubeChannelId'): Record<string, unknown> {
    return {
        [nameField]: 'creator',
        discordChannelId: 'channel-1',
        guildId: 'guild-1',
        customMessage: 'Live now',
        cooldownMinutes: 0,
        quietHoursStart: null,
        quietHoursEnd: null,
    };
}
