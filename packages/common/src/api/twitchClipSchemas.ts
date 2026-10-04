import { z } from 'zod';

const commandSchema = z.string().trim().min(1).max(32).regex(/^\S+$/).toLowerCase();
const fields = {
    guildId: z.string().min(1).max(255),
    twitchUsername: z.string().trim().min(1).max(25).regex(/^[a-zA-Z0-9_]+$/).toLowerCase(),
    discordChannelId: z.string().min(1).max(255),
    command: commandSchema,
    aliases: z.array(commandSchema).max(10),
    permission: z.enum(['everyone', 'subscribers', 'moderators', 'owner']),
    cooldownSeconds: z.number().int().min(15).max(3600),
    durationSeconds: z.number().int().min(5).max(60),
    enabled: z.boolean(),
    replyEnabled: z.boolean(),
    replyTemplate: z.string().trim().max(400).refine(value => !Array.from(value).some(character => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
    })).nullable(),
};

export const twitchClipCreateRequestSchema = z.object({
    ...fields,
    command: fields.command.default('!clip'),
    aliases: fields.aliases.default([]),
    permission: fields.permission.default('everyone'),
    cooldownSeconds: fields.cooldownSeconds.default(30),
    durationSeconds: fields.durationSeconds.default(30),
    enabled: fields.enabled.default(true),
    replyEnabled: fields.replyEnabled.default(true),
    replyTemplate: fields.replyTemplate.default(null),
}).strict();

export const twitchClipUpdateRequestSchema = z.object(fields).partial().strict().refine(value => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
});

export const twitchClipConfigResponseSchema = z.object({
    ...fields,
    id: z.string().uuid(),
    broadcasterId: z.string().min(1),
});
