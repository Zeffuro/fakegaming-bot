import { z } from 'zod';
import { schemaRegistry } from '../utils/schemaRegistry.js';
import { parseHHmmToMinutes } from '../utils/time.js';
import * as Models from '../models/index.js';

/** Register all custom Zod schema overrides for Sequelize models. */
export function registerSchemaOverrides(): void {
    // PatchSubscriptionConfig: custom create schema allowing server-managed timestamp override
    const patchSubscriptionCreateSchema = z.object({
        game: z.string().min(1),
        channelId: z.string().min(1),
        guildId: z.string().min(1),
        lastAnnouncedAt: z.number().int().optional()
    }).strict();
    schemaRegistry.registerCustom(Models.PatchSubscriptionConfig as any, 'create', patchSubscriptionCreateSchema);

    // QuoteConfig: allow optional id and submitterId on create
    const quoteCreateSchema = z.object({
        id: z.string().min(1).optional(),
        guildId: z.string().min(1),
        quote: z.string().min(1),
        authorId: z.string().min(1),
        submitterId: z.string().min(1).optional(),
        timestamp: z.number().int()
    }).strict();
    schemaRegistry.registerCustom(Models.QuoteConfig as any, 'create', quoteCreateSchema);

    // Helper: HH:mm validator for quiet hours
    const hhmm = z.string().refine((v) => parseHHmmToMinutes(v) !== null, {
        message: 'Expected time in HH:mm',
    });

    // TwitchStreamConfig: safe fields only; forbid isLive/lastNotifiedAt
    const twitchCreateSchema = z.object({
        twitchUsername: z.string().min(1),
        discordChannelId: z.string().min(1),
        guildId: z.string().min(1),
        customMessage: z.string().optional(),
        cooldownMinutes: z.number().int().min(0).nullable().optional(),
        quietHoursStart: hhmm.nullable().optional(),
        quietHoursEnd: hhmm.nullable().optional(),
    }).strict();

    const twitchUpdateSchema = z.object({
        twitchUsername: z.string().min(1).optional(),
        discordChannelId: z.string().min(1).optional(),
        guildId: z.string().min(1).optional(),
        customMessage: z.string().optional(),
        cooldownMinutes: z.number().int().min(0).nullable().optional(),
        quietHoursStart: hhmm.nullable().optional(),
        quietHoursEnd: hhmm.nullable().optional(),
    }).strict();

    schemaRegistry.registerCustom(Models.TwitchStreamConfig as any, 'create', twitchCreateSchema);
    schemaRegistry.registerCustom(Models.TwitchStreamConfig as any, 'update', twitchUpdateSchema);

    // YoutubeVideoConfig: safe fields only; forbid lastVideoId/lastNotifiedAt
    const youtubeCreateSchema = z.object({
        youtubeChannelId: z.string().min(1),
        discordChannelId: z.string().min(1),
        guildId: z.string().min(1),
        customMessage: z.string().optional(),
        cooldownMinutes: z.number().int().min(0).nullable().optional(),
        quietHoursStart: hhmm.nullable().optional(),
        quietHoursEnd: hhmm.nullable().optional(),
    }).strict();

    const youtubeUpdateSchema = z.object({
        youtubeChannelId: z.string().min(1).optional(),
        discordChannelId: z.string().min(1).optional(),
        guildId: z.string().min(1).optional(),
        customMessage: z.string().optional(),
        cooldownMinutes: z.number().int().min(0).nullable().optional(),
        quietHoursStart: hhmm.nullable().optional(),
        quietHoursEnd: hhmm.nullable().optional(),
    }).strict();

    schemaRegistry.registerCustom(Models.YoutubeVideoConfig as any, 'create', youtubeCreateSchema);
    schemaRegistry.registerCustom(Models.YoutubeVideoConfig as any, 'update', youtubeUpdateSchema);

    // TikTokStreamConfig: safe fields only; forbid isLive/lastNotifiedAt
    const tiktokCreateSchema = z.object({
        tiktokUsername: z.string().min(1),
        discordChannelId: z.string().min(1),
        guildId: z.string().min(1),
        customMessage: z.string().optional(),
        cooldownMinutes: z.number().int().min(0).nullable().optional(),
        quietHoursStart: hhmm.nullable().optional(),
        quietHoursEnd: hhmm.nullable().optional(),
    }).strict();

    const tiktokUpdateSchema = z.object({
        tiktokUsername: z.string().min(1).optional(),
        discordChannelId: z.string().min(1).optional(),
        guildId: z.string().min(1).optional(),
        customMessage: z.string().optional(),
        cooldownMinutes: z.number().int().min(0).nullable().optional(),
        quietHoursStart: hhmm.nullable().optional(),
        quietHoursEnd: hhmm.nullable().optional(),
    }).strict();

    schemaRegistry.registerCustom(Models.TikTokStreamConfig as any, 'create', tiktokCreateSchema);
    schemaRegistry.registerCustom(Models.TikTokStreamConfig as any, 'update', tiktokUpdateSchema);
}
