import { z } from 'zod';

export const idParamSchema = z.object({ id: z.coerce.number().int() });

export const existsQuerySchema = z.object({
    blueskyHandle: z.string().min(1),
    discordChannelId: z.string().min(1),
    guildId: z.string().min(1)
});

export const profileQuerySchema = z.object({
    handle: z.string().min(1),
});
