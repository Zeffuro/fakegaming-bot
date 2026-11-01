import { MessageFlags, PermissionFlagsBits, type ButtonInteraction, type ChatInputCommandInteraction, type ModalSubmitInteraction } from 'discord.js';
import { getConfigManager, type SubmissionManager, type SubmissionRecordData } from '@zeffuro/fakegaming-common/managers';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import {
    liveMember, requireBotMessage, requirePrivateControl, requireReviewControl, requireReviewer, requireSubmissionsEnabled,
    type SubmissionInteraction,
} from './access.js';
import { SubmissionControlError, submissionCopy, submissionFailure } from './copy.js';
import { reviewForm, submissionForm } from './forms.js';
import { renderOwnList, renderSubmission, renderSubmissionPanel } from './presentation.js';
import { SubmissionRuntime } from './runtime.js';

const ITEM_ID = /^submissions:(show|review|approve|reject|changes|edit|revision|reconcile):([0-9a-f-]{36})(?::(\d{1,10}))?$/i;

export function createSubmissionHandlers(manager: SubmissionManager = getConfigManager().submissionManager,
    runtimeFor = (interaction: { client: ButtonInteraction['client'] }) => new SubmissionRuntime(interaction.client, manager)) {
    async function availableCategories(interaction: ChatInputCommandInteraction | SubmissionInteraction) {
        const guildId = await requireSubmissionsEnabled(interaction.guildId);
        const roles = interactionRoles(interaction);
        return (await manager.listCategories(guildId, true)).filter(category => category.submitterRoleIds.length === 0
            || category.submitterRoleIds.some(id => roles.includes(id)));
    }

    async function itemFor(interaction: SubmissionInteraction, openingModal = false) {
        const match = ITEM_ID.exec(interaction.customId);
        if (!match) throw new SubmissionControlError('missing');
        const guildId = await requireSubmissionsEnabled(interaction.guildId);
        const item = await manager.get(guildId, match[2]!);
        if (!item) throw new SubmissionControlError('missing');
        const action = match[1]!;
        let categoryVersion: number | undefined;
        if (['show', 'edit', 'revision'].includes(action)) {
            requirePrivateControl(interaction);
            if (item.userId !== interaction.user.id) throw new SubmissionControlError('missing');
        } else {
            requireReviewControl(interaction, item);
            if (openingModal) {
                const category = await manager.getCategory(guildId, item.categoryId);
                if (!category?.enabled || (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
                    && !category.reviewerRoleIds.some(id => interactionRoles(interaction).includes(id)))) throw new SubmissionControlError('missing');
            } else categoryVersion = (await requireReviewer(interaction.client, item, interaction.user.id)).category.version;
        }
        if (action !== 'show' && action !== 'review' && (!match[3] || item.version !== Number(match[3]))) {
            throw Object.assign(new Error('Stale submission'), { code: 'stale' });
        }
        return { item, action, categoryVersion };
    }

    async function panelControl(interaction: SubmissionInteraction): Promise<void> {
        requireBotMessage(interaction);
        const panel = await manager.getPanel(interaction.guildId!);
        if (!panel || panel.channelId !== interaction.channelId || panel.messageId !== interaction.message?.id) throw new SubmissionControlError('missing');
    }

    async function ownList(interaction: ChatInputCommandInteraction | ButtonInteraction, page: number) {
        const items = await manager.listOwn(interaction.guildId!, interaction.user.id, page);
        const locale = await resolveInteractionOutputLocale(interaction);
        await interaction.editReply(renderOwnList(items, page, locale));
    }

    async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const command = interaction.options.getSubcommand();
        if (command !== 'submit') await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const locale = await resolveInteractionOutputLocale(interaction);
        const t = submissionCopy(locale);
        try {
            await requireSubmissionsEnabled(interaction.guildId);
            if (command === 'submit') {
                const categories = await availableCategories(interaction);
                if (!categories.length) throw new SubmissionControlError('unavailable');
                await interaction.showModal(submissionForm(categories, locale));
                return;
            }
            if (command === 'mine') await ownList(interaction, (interaction.options.getInteger('page') ?? 1) - 1);
            else if (command === 'show') {
                const item = await manager.get(interaction.guildId!, interaction.options.getString('id', true));
                if (!item || item.userId !== interaction.user.id) throw new SubmissionControlError('missing');
                await interaction.editReply(renderSubmission(item, locale, false, []));
            } else if (command === 'panel') {
                const guild = await interaction.client.guilds.fetch(interaction.guildId!);
                const member = await liveMember(guild, interaction.user.id);
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) throw new SubmissionControlError('missing');
                const channelId = interaction.options.getChannel('channel', true).id;
                const channel = await guild.channels.fetch(channelId, { force: true });
                const bot = await guild.members.fetchMe({ force: true });
                if (!channel || channel.type !== 0 || !channel.permissionsFor(bot)?.has([
                    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
                ])) throw new SubmissionControlError('setup');
                const current = await manager.getPanel(guild.id);
                let message;
                if (current?.channelId === channel.id) {
                    const previous = await channel.messages.fetch({ message: current.messageId, force: true }).catch(() => null);
                    if (previous?.author.id === interaction.client.user.id) message = await previous.edit(renderSubmissionPanel(locale));
                }
                message ??= await channel.send(renderSubmissionPanel(locale));
                await manager.setPanel(guild.id, { channelId: channel.id, messageId: message.id });
                if (current && (current.channelId !== channel.id || current.messageId !== message.id)) {
                    const oldChannel = await guild.channels.fetch(current.channelId).catch(() => null);
                    if (oldChannel?.type === 0) {
                        const oldMessage = await oldChannel.messages.fetch(current.messageId).catch(() => null);
                        if (oldMessage?.author.id === interaction.client.user.id) await oldMessage.edit({ components: [] }).catch(() => undefined);
                    }
                }
                await interaction.editReply({ content: t('panelPosted', { channel: `<#${channel.id}>` }), allowedMentions: { parse: [] } });
            }
        } catch (error) { await failure(interaction, error); }
    }

    async function handleComponent(interaction: ButtonInteraction): Promise<boolean> {
        if (!interaction.customId.startsWith('submissions:')) return false;
        const openingModal = interaction.customId === 'submissions:submit' || /^submissions:(edit|reject|changes):/.test(interaction.customId);
        if (!openingModal) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const locale = await resolveInteractionOutputLocale(interaction);
        try {
            await requireSubmissionsEnabled(interaction.guildId);
            if (interaction.customId === 'submissions:submit') {
                await panelControl(interaction);
                const categories = await availableCategories(interaction);
                if (!categories.length) throw new SubmissionControlError('unavailable');
                await interaction.showModal(submissionForm(categories, locale));
                return true;
            }
            const mine = /^submissions:mine:(\d{1,5})$/.exec(interaction.customId);
            if (mine) {
                if (interaction.message.flags.has(MessageFlags.Ephemeral)) requirePrivateControl(interaction);
                else await panelControl(interaction);
                await ownList(interaction, Number(mine[1]));
                return true;
            }
            const { item, action } = await itemFor(interaction, openingModal);
            if (action === 'edit') {
                if (!['changes_requested', 'upload_failed'].includes(item.status)) throw new SubmissionControlError('missing');
                const categories = (await availableCategories(interaction)).filter(category => category.id === item.categoryId);
                if (!categories.length) throw new SubmissionControlError('unavailable');
                await interaction.showModal(submissionForm(categories, locale, item));
                return true;
            }
            if (action === 'reject' || action === 'changes') {
                if (!['pending', 'publish_failed'].includes(item.status)) throw new SubmissionControlError('missing');
                await interaction.showModal(reviewForm(item, action, locale));
                return true;
            }
            const runtime = runtimeFor(interaction);
            if (action === 'show') await interaction.editReply(renderSubmission(item, locale, false, []));
            else if (action === 'review') {
                await runtime.refresh(item.guildId, item.id);
                await interaction.editReply({ content: submissionCopy(locale)('reviewed') });
            } else if (action === 'approve') {
                const updated = await runtime.publish(item, interaction.user.id);
                await interaction.editReply({ content: submissionCopy(locale)(updated.status === 'published' ? 'published'
                    : updated.status === 'uncertain' ? 'uncertain' : 'publishFailed') });
            } else if (action === 'reconcile') {
                const updated = await runtime.reconcile(item, interaction.user.id);
                await interaction.editReply({ content: submissionCopy(locale)(updated ? 'published' : 'notLocated') });
            } else throw new SubmissionControlError('missing');
        } catch (error) { await failure(interaction, error); }
        return true;
    }

    async function handleModal(interaction: ModalSubmitInteraction): Promise<boolean> {
        if (!interaction.customId.startsWith('submissions:')) return false;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const locale = await resolveInteractionOutputLocale(interaction);
        try {
            await requireSubmissionsEnabled(interaction.guildId);
            const runtime = runtimeFor(interaction);
            let revision: SubmissionRecordData | undefined;
            if (interaction.customId !== 'submissions:new') {
                const { item, action, categoryVersion } = await itemFor(interaction);
                if (action === 'reject' || action === 'changes') {
                    const updated = await manager.review(item.guildId, item.id, item.version, interaction.user.id, action,
                        interaction.fields.getTextInputValue('reason'), categoryVersion);
                    await runtime.refresh(item.guildId, item.id).catch(() => undefined);
                    await runtime.notify(updated);
                    await interaction.editReply({ content: submissionCopy(locale)('reviewed') });
                    return true;
                }
                if (action !== 'revision') throw new SubmissionControlError('missing');
                revision = item;
            }
            const categoryId = interaction.fields.getStringSelectValues('category')[0];
            const category = categoryId ? await manager.getCategory(interaction.guildId!, categoryId) : null;
            if (!category || (revision && revision.categoryId !== category.id)) throw new SubmissionControlError('unavailable');
            const uploads = [...(interaction.fields.getUploadedFiles('screenshots')?.values() ?? [])];
            await runtime.submit(category, interaction.user.id, {
                explanation: interaction.fields.getTextInputValue('explanation'), link: interaction.fields.getTextInputValue('link') || null,
                credit: interaction.fields.getTextInputValue('credit') || null, attachmentCount: uploads.length,
            }, uploads, revision);
            await interaction.editReply({ content: submissionCopy(locale)('received') });
        } catch (error) { await failure(interaction, error); }
        return true;
    }

    return { execute, handleComponent, handleModal };
}

async function failure(interaction: ChatInputCommandInteraction | SubmissionInteraction, error: unknown) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const payload = { content: submissionFailure(error, locale), allowedMentions: { parse: [] as never[] } };
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

function interactionRoles(interaction: ChatInputCommandInteraction | SubmissionInteraction): string[] {
    const member = interaction.member;
    if (!member) return [];
    return Array.isArray(member.roles) ? member.roles : [...member.roles.cache.keys()];
}
