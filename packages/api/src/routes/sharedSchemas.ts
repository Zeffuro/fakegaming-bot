import { z } from 'zod';

export const numericIdParamSchema = z.object({ id: z.coerce.number().int() });
export const optionalGuildListQuerySchema = z.object({ guildId: z.string().min(1).optional() });
