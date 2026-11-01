import { z } from 'zod';
import { validateSubmissionChannelPermissions, type SubmissionCategoryInput } from '@zeffuro/fakegaming-common';

export class SubmissionConfigError extends Error {
    constructor(public readonly code: 'provider-unavailable' | 'invalid-channel' | 'invalid-role' | 'review-access'
        | 'destination-write' | 'bot-permissions' | 'reviewer-access') { super(code); }
}

const roleSchema = z.object({ id: z.string(), name: z.string(), managed: z.boolean().optional().default(false), permissions: z.string() });
const channelSchema = z.object({
    id: z.string(), name: z.string().optional().default(''), type: z.number(), guild_id: z.string(),
    permission_overwrites: z.array(z.object({ id: z.string(), type: z.union([z.literal(0), z.literal(1)]),
        allow: z.string().optional(), deny: z.string().optional(),
        allow_new: z.string().optional(), deny_new: z.string().optional(),
    }).refine(item => (item.allow_new ?? item.allow) !== undefined && (item.deny_new ?? item.deny) !== undefined)
        .transform(item => ({ id: item.id, type: item.type, allow: item.allow_new ?? item.allow!,
            deny: item.deny_new ?? item.deny! }))).optional().default([]),
});

async function discord(path: string): Promise<unknown> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new SubmissionConfigError('provider-unavailable');
    try {
        const response = await fetch(`https://discord.com/api/v10${path}`, {
            headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new SubmissionConfigError('provider-unavailable');
        return await response.json();
    } catch { throw new SubmissionConfigError('provider-unavailable'); }
}

export async function getSubmissionOptions(guildId: string) {
    const [rolesResult, channelsResult] = await Promise.all([
        discord(`/guilds/${encodeURIComponent(guildId)}/roles`), discord(`/guilds/${encodeURIComponent(guildId)}/channels`),
    ]);
    const roles = z.array(roleSchema).safeParse(rolesResult);
    const channels = z.array(channelSchema).safeParse(channelsResult);
    if (!roles.success || !channels.success || channels.data.some(channel => channel.guild_id !== guildId)) {
        throw new SubmissionConfigError('provider-unavailable');
    }
    return { roles: roles.data, channels: channels.data };
}

export async function validateSubmissionConfig(guildId: string, input: SubmissionCategoryInput): Promise<void> {
    const [options, botResult] = await Promise.all([getSubmissionOptions(guildId), discord('/users/@me')]);
    const bot = z.object({ id: z.string() }).safeParse(botResult);
    if (!bot.success) throw new SubmissionConfigError('provider-unavailable');
    const member = z.object({ roles: z.array(z.string()) }).safeParse(await discord(`/guilds/${encodeURIComponent(guildId)}/members/${bot.data.id}`));
    if (!member.success) throw new SubmissionConfigError('provider-unavailable');
    if (input.submitterRoleIds.some(id => !options.roles.some(role => role.id === id))) throw new SubmissionConfigError('invalid-role');
    const reviewChannel = options.channels.find(channel => channel.id === input.reviewChannelId);
    const destinationChannel = options.channels.find(channel => channel.id === input.destinationChannelId);
    if (!reviewChannel || !destinationChannel) throw new SubmissionConfigError('invalid-channel');
    const toChannel = (channel: typeof reviewChannel) => ({ id: channel.id, guildId: channel.guild_id,
        type: channel.type, permissionOverwrites: channel.permission_overwrites });
    const result = validateSubmissionChannelPermissions({ guildId, botId: bot.data.id, roles: options.roles,
        botRoleIds: member.data.roles, reviewerRoleIds: input.reviewerRoleIds,
        reviewChannel: toChannel(reviewChannel), destinationChannel: toChannel(destinationChannel) });
    if (!result.valid) throw new SubmissionConfigError(result.reason ?? 'invalid-channel');
}
