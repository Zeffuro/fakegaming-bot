import { z } from 'zod';
import { parseHHmmToMinutes } from '../utils/time.js';

const nonEmptyString = z.string().min(1);

const hhmmSchema = z.string().refine((value) => parseHHmmToMinutes(value) !== null, {
    message: 'Expected time in HH:mm',
});

const notificationFields = {
    customMessage: z.string().optional(),
    cooldownMinutes: z.number().int().min(0).nullable().optional(),
    quietHoursStart: hhmmSchema.nullable().optional(),
    quietHoursEnd: hhmmSchema.nullable().optional(),
    paused: z.boolean().optional(),
};

function hasAtLeastOneField(value: Record<string, unknown>): boolean {
    return Object.keys(value).length > 0;
}

function isValidBirthdayDate(value: { day: number; month: number; year?: number }): boolean {
    const testYear = value.year ?? 2000;
    const date = new Date(testYear, value.month - 1, value.day);
    return date.getFullYear() === testYear
        && date.getMonth() === value.month - 1
        && date.getDate() === value.day;
}

const birthdayDateFieldsSchema = z.object({
    day: z.coerce.number().int().min(1).max(31),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(1900).max(9999).optional(),
}).strict();

export const authLoginRequestSchema = z.object({
    code: nonEmptyString,
}).strict();

export const animeSubscribeRequestSchema = z.object({
    anilistId: z.coerce.number().int().positive().optional(),
    title: nonEmptyString.optional(),
    guildId: nonEmptyString,
    channelId: nonEmptyString,
    reminderMinutes: z.coerce.number().int().min(0).max(1440).optional(),
}).strict().refine((value) => value.anilistId || value.title, {
    message: 'anilistId or title is required',
    path: ['anilistId'],
});

export const birthdayCreateRequestSchema = birthdayDateFieldsSchema.extend({
    userId: nonEmptyString,
    guildId: nonEmptyString,
    channelId: nonEmptyString,
}).refine(isValidBirthdayDate, {
    message: 'Invalid calendar date',
    path: ['day'],
});

export const birthdayUpdateRequestSchema = birthdayDateFieldsSchema.extend({
    channelId: nonEmptyString,
}).refine(isValidBirthdayDate, {
    message: 'Invalid calendar date',
    path: ['day'],
});

export const blueskyCreateRequestSchema = z.object({
    blueskyHandle: nonEmptyString,
    discordChannelId: nonEmptyString,
    guildId: nonEmptyString,
    ...notificationFields,
}).strict();

export const blueskyUpdateRequestSchema = z.object({
    blueskyHandle: nonEmptyString.optional(),
    discordChannelId: nonEmptyString.optional(),
    guildId: nonEmptyString.optional(),
    ...notificationFields,
}).strict().refine(hasAtLeastOneField, {
    message: 'At least one field must be provided',
});

export const disabledCommandCreateRequestSchema = z.object({
    guildId: nonEmptyString,
    commandName: nonEmptyString,
}).strict();

export const disabledModuleCreateRequestSchema = z.object({
    guildId: nonEmptyString,
    moduleName: nonEmptyString,
}).strict();

export const discordResolveUsersRequestSchema = z.object({
    guildId: nonEmptyString,
    ids: z.array(nonEmptyString).max(50),
}).strict();

export const jobRunRequestSchema = z.object({
    date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
        message: 'Invalid date-time',
    }).optional(),
    force: z.boolean().optional(),
}).strict();

export const patchNoteCreateRequestSchema = z.object({
    game: nonEmptyString,
    title: nonEmptyString,
    content: nonEmptyString,
    url: nonEmptyString,
    publishedAt: z.number().int(),
    version: nonEmptyString,
}).strict();

export const patchSubscriptionRequestSchema = z.object({
    game: nonEmptyString,
    channelId: nonEmptyString,
    guildId: nonEmptyString,
    paused: z.boolean().optional(),
}).strict();

export const pausedStateRequestSchema = z.object({
    paused: z.boolean(),
}).strict();

export const steamNewsSubscriptionRequestSchema = z.object({
    steamAppId: z.coerce.number().int().positive(),
    appName: nonEmptyString.optional(),
    discordChannelId: nonEmptyString,
    guildId: nonEmptyString,
    ...notificationFields,
}).strict();

export const quoteCreateRequestSchema = z.object({
    id: nonEmptyString.optional(),
    guildId: nonEmptyString,
    quote: nonEmptyString,
    authorId: nonEmptyString,
    submitterId: nonEmptyString.optional(),
    timestamp: z.number().int(),
}).strict();

export const reminderCreateRequestSchema = z.object({
    id: nonEmptyString,
    userId: nonEmptyString,
    message: nonEmptyString,
    timespan: nonEmptyString,
    timestamp: z.number().int(),
    completed: z.boolean().optional(),
}).strict();

export const riotLinkUpdateRequestSchema = z.object({
    summonerName: nonEmptyString,
    riotIdGameName: nonEmptyString.nullable().optional(),
    riotIdTagLine: nonEmptyString.nullable().optional(),
    region: nonEmptyString,
    puuid: nonEmptyString,
}).strict();

export const serverCreateRequestSchema = z.object({
    serverId: nonEmptyString,
    name: nonEmptyString.optional(),
    prefix: nonEmptyString.optional(),
}).strict();

export const serverUpdateRequestSchema = z.object({
    name: nonEmptyString.optional(),
    prefix: nonEmptyString.optional(),
}).strict().refine(hasAtLeastOneField, {
    message: 'At least one field must be provided',
});

export const tiktokCreateRequestSchema = z.object({
    tiktokUsername: nonEmptyString,
    discordChannelId: nonEmptyString,
    guildId: nonEmptyString,
    ...notificationFields,
}).strict();

export const tiktokUpdateRequestSchema = z.object({
    tiktokUsername: nonEmptyString.optional(),
    discordChannelId: nonEmptyString.optional(),
    guildId: nonEmptyString.optional(),
    ...notificationFields,
}).strict().refine(hasAtLeastOneField, {
    message: 'At least one field must be provided',
});

export const twitchCreateRequestSchema = z.object({
    twitchUsername: nonEmptyString,
    discordChannelId: nonEmptyString,
    guildId: nonEmptyString,
    ...notificationFields,
}).strict();

export const twitchUpdateRequestSchema = z.object({
    twitchUsername: nonEmptyString.optional(),
    discordChannelId: nonEmptyString.optional(),
    guildId: nonEmptyString.optional(),
    ...notificationFields,
}).strict().refine(hasAtLeastOneField, {
    message: 'At least one field must be provided',
});

export const userCreateRequestSchema = z.object({
    discordId: nonEmptyString,
    timezone: nonEmptyString.optional(),
    defaultReminderTimeSpan: nonEmptyString.optional(),
}).strict();

export const userUpdateRequestSchema = z.object({
    timezone: nonEmptyString.optional(),
    defaultReminderTimeSpan: nonEmptyString.optional(),
}).strict().refine(hasAtLeastOneField, {
    message: 'At least one field must be provided',
});

export const userTimezoneUpdateRequestSchema = z.object({
    timezone: nonEmptyString,
}).strict();

export const userDefaultReminderTimeSpanUpdateRequestSchema = z.object({
    timespan: nonEmptyString,
}).strict();

export const userReminderCreateRequestSchema = z.object({
    message: z.string().trim().min(1).max(2000),
    timespan: nonEmptyString,
}).strict();

export const userReminderSnoozeRequestSchema = z.object({
    timespan: nonEmptyString,
}).strict();

export const userNoteCreateRequestSchema = z.object({
    title: z.string().trim().max(160).optional(),
    body: z.string().max(20000).optional(),
    pinned: z.boolean().optional(),
}).strict().refine((value) => Boolean(value.title?.trim() || value.body?.trim()), {
    message: 'title or body is required',
});

export const userNoteUpdateRequestSchema = z.object({
    title: z.string().trim().max(160).optional(),
    body: z.string().max(20000).optional(),
    pinned: z.boolean().optional(),
}).strict().refine(hasAtLeastOneField, {
    message: 'At least one field must be provided',
});

export const youtubeChannelRequestSchema = z.object({
    youtubeChannelId: nonEmptyString,
    discordChannelId: nonEmptyString,
    guildId: nonEmptyString,
}).strict();

export const youtubeCreateRequestSchema = z.object({
    youtubeChannelId: nonEmptyString,
    discordChannelId: nonEmptyString,
    guildId: nonEmptyString,
    ...notificationFields,
}).strict();

export const youtubeUpdateRequestSchema = z.object({
    youtubeChannelId: nonEmptyString.optional(),
    discordChannelId: nonEmptyString.optional(),
    guildId: nonEmptyString.optional(),
    ...notificationFields,
}).strict().refine(hasAtLeastOneField, {
    message: 'At least one field must be provided',
});

export const apiRequestSchemas = {
    AnimeSubscribeRequest: animeSubscribeRequestSchema,
    AuthLoginRequest: authLoginRequestSchema,
    BirthdayCreateRequest: birthdayCreateRequestSchema,
    BirthdayUpdateRequest: birthdayUpdateRequestSchema,
    BlueskyCreateRequest: blueskyCreateRequestSchema,
    BlueskyUpdateRequest: blueskyUpdateRequestSchema,
    DisabledCommandCreateRequest: disabledCommandCreateRequestSchema,
    DisabledModuleCreateRequest: disabledModuleCreateRequestSchema,
    DiscordResolveUsersRequest: discordResolveUsersRequestSchema,
    JobRunRequest: jobRunRequestSchema,
    PausedStateRequest: pausedStateRequestSchema,
    PatchNoteCreateRequest: patchNoteCreateRequestSchema,
    PatchSubscriptionRequest: patchSubscriptionRequestSchema,
    QuoteCreateRequest: quoteCreateRequestSchema,
    ReminderCreateRequest: reminderCreateRequestSchema,
    RiotLinkUpdateRequest: riotLinkUpdateRequestSchema,
    ServerCreateRequest: serverCreateRequestSchema,
    ServerUpdateRequest: serverUpdateRequestSchema,
    SteamNewsSubscriptionRequest: steamNewsSubscriptionRequestSchema,
    TikTokCreateRequest: tiktokCreateRequestSchema,
    TikTokUpdateRequest: tiktokUpdateRequestSchema,
    TwitchCreateRequest: twitchCreateRequestSchema,
    TwitchUpdateRequest: twitchUpdateRequestSchema,
    UserCreateRequest: userCreateRequestSchema,
    UserDefaultReminderTimeSpanUpdateRequest: userDefaultReminderTimeSpanUpdateRequestSchema,
    UserNoteCreateRequest: userNoteCreateRequestSchema,
    UserNoteUpdateRequest: userNoteUpdateRequestSchema,
    UserReminderCreateRequest: userReminderCreateRequestSchema,
    UserReminderSnoozeRequest: userReminderSnoozeRequestSchema,
    UserTimezoneUpdateRequest: userTimezoneUpdateRequestSchema,
    UserUpdateRequest: userUpdateRequestSchema,
    YoutubeChannelRequest: youtubeChannelRequestSchema,
    YoutubeCreateRequest: youtubeCreateRequestSchema,
    YoutubeUpdateRequest: youtubeUpdateRequestSchema,
} as const satisfies Record<string, z.ZodType<unknown>>;
