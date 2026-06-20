import { z } from 'zod';
export { numericIdParamSchema as idParamSchema } from './sharedSchemas.js';

export const existsQuerySchema = z.object({
    tiktokUsername: z.string().min(1),
    discordChannelId: z.string().min(1),
    guildId: z.string().min(1)
});

export const liveQuerySchema = z.object({
    username: z.string().min(1),
    debug: z.coerce.boolean().optional(),
    mode: z.enum(['connect', 'light']).optional()
});
