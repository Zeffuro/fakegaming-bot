import { z } from 'zod';

export const twitchClipChatMessageSchema = z.object({
    broadcaster_user_id: z.string().min(1).max(255),
    broadcaster_user_name: z.string().max(255),
    chatter_user_id: z.string().min(1).max(255),
    chatter_user_name: z.string().max(255),
    message_id: z.string().min(1).max(255),
    message: z.object({ text: z.string().max(4096) }),
    badges: z.array(z.object({ set_id: z.string() })).max(100),
    source_broadcaster_user_id: z.string().nullable().optional(),
});

export type TwitchClipChatMessage = z.infer<typeof twitchClipChatMessageSchema>;

export interface ClipCommandConfig {
    id: string;
    broadcasterId: string;
    command: string;
    aliases: string[];
    permission: string;
    enabled: boolean;
    cooldownSeconds: number;
    durationSeconds: number;
}

export function matchesClipCommand(config: ClipCommandConfig, message: TwitchClipChatMessage): boolean {
    if (!config.enabled || config.broadcasterId !== message.broadcaster_user_id) return false;
    // Relayed shared-chat messages must never clip the receiving broadcaster's stream.
    if (message.source_broadcaster_user_id && message.source_broadcaster_user_id !== message.broadcaster_user_id) return false;
    const token = message.message.text.trim().split(/\s+/, 1)[0]?.toLowerCase();
    if (!token || ![config.command, ...config.aliases].some(command => command.toLowerCase() === token)) return false;

    const owner = message.chatter_user_id === message.broadcaster_user_id;
    const moderator = message.badges.some(badge => badge.set_id === 'moderator');
    const subscriber = message.badges.some(badge => badge.set_id === 'subscriber' || badge.set_id === 'founder');
    switch (config.permission) {
        case 'everyone': return true;
        case 'subscribers': return owner || moderator || subscriber;
        case 'moderators': return owner || moderator;
        case 'owner': return owner;
        default: return false;
    }
}
