import {
    ChannelType, MessageFlags, PermissionFlagsBits, type ButtonInteraction, type Client,
    type Guild, type GuildBasedChannel, type GuildMember, type ModalSubmitInteraction, type NewsChannel, type TextChannel,
} from 'discord.js';
import { validateSubmissionChannelPermissions, type SubmissionPermissionChannel } from '@zeffuro/fakegaming-common';
import { getConfigManager, type SubmissionCategoryData, type SubmissionRecordData } from '@zeffuro/fakegaming-common/managers';
import { SubmissionControlError } from './copy.js';
import { SubmissionDiagnosticError } from './diagnostics.js';

export type SubmissionInteraction = ButtonInteraction | ModalSubmitInteraction;
export type SubmissionTextChannel = TextChannel | NewsChannel;

export async function requireSubmissionsEnabled(guildId: string | null): Promise<string> {
    if (!guildId) throw new SubmissionControlError('unavailable');
    const config = getConfigManager();
    if (await config.disabledModuleManager.isModuleDisabled(guildId, 'submissions')
        || await config.disabledCommandManager.isCommandDisabled(guildId, 'submissions')) throw new SubmissionControlError('unavailable');
    return guildId;
}

export async function fetchSubmissionChannels(client: Client, category: SubmissionCategoryData, item?: SubmissionRecordData) {
    if (!category.enabled) throw new SubmissionControlError('unavailable');
    try {
        const guild = await client.guilds.fetch(category.guildId);
        const [roles, bot, review, destination] = await Promise.all([
            guild.roles.fetch(), guild.members.fetchMe({ force: true }),
            guild.channels.fetch(item?.reviewChannelId ?? category.reviewChannelId, { force: true }),
            guild.channels.fetch(item?.destinationChannelId ?? category.destinationChannelId, { force: true }),
        ]);
        if (!review || review.type !== ChannelType.GuildText || !destination
            || (destination.type !== ChannelType.GuildText && destination.type !== ChannelType.GuildAnnouncement)) throw new SubmissionDiagnosticError('setup', { reason: 'invalid-channel' });
        const validation = validateSubmissionChannelPermissions({
            guildId: guild.id, botId: bot.id, roles: roles.map(role => ({ id: role.id, permissions: role.permissions.bitfield.toString(), managed: role.managed })),
            botRoleIds: [...bot.roles.cache.keys()], reviewerRoleIds: category.reviewerRoleIds,
            reviewChannel: permissionChannel(review), destinationChannel: permissionChannel(destination),
        });
        if (!validation.valid) throw new SubmissionDiagnosticError('setup', { reason: validation.reason ?? 'invalid-channel' });
        return { guild, review, destination };
    } catch (error) {
        if (error instanceof SubmissionDiagnosticError) throw error;
        throw new SubmissionControlError('setup', { cause: error });
    }
}

function permissionChannel(channel: GuildBasedChannel & (TextChannel | NewsChannel)): SubmissionPermissionChannel {
    return { id: channel.id, guildId: channel.guildId, type: channel.type,
        permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id, type: overwrite.type === 0 ? 0 : 1,
            allow: overwrite.allow.bitfield.toString(), deny: overwrite.deny.bitfield.toString(),
        })) };
}

export async function liveMember(guild: Guild, userId: string): Promise<GuildMember> {
    try { return await guild.members.fetch({ user: userId, force: true }); }
    catch (error) { throw new SubmissionControlError('missing', { cause: error }); }
}

export function canSubmit(category: SubmissionCategoryData, member: GuildMember): boolean {
    return category.enabled && (category.submitterRoleIds.length === 0
        || category.submitterRoleIds.some(id => member.roles.cache.has(id)));
}

export async function requireReviewer(client: Client, item: SubmissionRecordData, userId: string) {
    const category = await getConfigManager().submissionManager.getCategory(item.guildId, item.categoryId);
    if (!category) throw new SubmissionControlError('missing');
    const channels = await fetchSubmissionChannels(client, category, item);
    const member = await liveMember(channels.guild, userId);
    if ((!member.permissions.has(PermissionFlagsBits.Administrator) && !category.reviewerRoleIds.some(id => member.roles.cache.has(id)))
        || !channels.review.permissionsFor(member)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) {
        throw new SubmissionControlError('missing');
    }
    return { ...channels, category };
}

export function requireBotMessage(interaction: SubmissionInteraction): void {
    if (!interaction.message || interaction.message.author.id !== interaction.client.user.id) throw new SubmissionControlError('missing');
}

export function requirePrivateControl(interaction: SubmissionInteraction): void {
    requireBotMessage(interaction);
    if (!interaction.message?.flags.has(MessageFlags.Ephemeral)) throw new SubmissionControlError('missing');
}

export function requireReviewControl(interaction: SubmissionInteraction, item: SubmissionRecordData): void {
    requireBotMessage(interaction);
    if (interaction.channelId !== item.reviewChannelId || interaction.message?.id !== item.reviewMessageId) throw new SubmissionControlError('missing');
}
