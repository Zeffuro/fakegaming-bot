import { ActionRowBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction, type ModalSubmitInteraction } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { parseReminderTime } from '@zeffuro/fakegaming-common/utils';
import { parseCompletedTime } from './completedTime.js';
import { renderHistory, renderSchedule } from './renderSchedule.js';
import { invalidSchedule, scheduleCopy, scheduleFailure, scheduleLocale } from './scheduleCopy.js';

type Interaction = ButtonInteraction | ModalSubmitInteraction;
const ID = /^schedule:([dtshun]):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{1,10})$/i;

async function available(interaction: Interaction) {
    const match = ID.exec(interaction.customId);
    if (!match) invalidSchedule();
    const message = interaction.message;
    if (!message || !interaction.client.user || message.author.id !== interaction.client.user.id
        || (interaction.guildId && !message.flags.has(MessageFlags.Ephemeral))) throw Object.assign(new Error('Missing'), { code: 'missing' });
    const item = await getConfigManager().userScheduleManager.get(match[2]!, interaction.user.id);
    if (!item || item.userId !== interaction.user.id) throw Object.assign(new Error('Missing'), { code: 'missing' });
    if (item.version !== Number(match[3])) throw Object.assign(new Error('Stale'), { code: 'stale' });
    return { item, action: match[1]! };
}

export async function handleComponent(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('schedule:')) return false;
    const modalAction = /^schedule:[tsn]:/.test(interaction.customId);
    if (!modalAction) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await scheduleLocale(interaction);
    const t = scheduleCopy(locale);
    try {
        const { item, action } = await available(interaction);
        if (modalAction) {
            const label = action === 'n' ? t('noteLabel') : t('timeLabel');
            const input = new TextInputBuilder().setCustomId('value').setLabel(label).setStyle(action === 'n' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(action !== 'n').setMaxLength(action === 'n' ? 1000 : 100);
            if (action === 'n' && item.note) input.setValue(item.note);
            if (action !== 'n') input.setPlaceholder(t('timePlaceholder'));
            const modal = new ModalBuilder().setCustomId(interaction.customId).setTitle(t(action === 't' ? 'earlier' : action === 's' ? 'later' : 'note'))
                .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
            await interaction.showModal(modal);
            return true;
        }
        const manager = getConfigManager().userScheduleManager;
        if (action === 'h') await interaction.editReply(renderHistory(await manager.list(interaction.user.id, 'all', item.scheduleId), locale));
        else {
            const updated = action === 'd' ? await manager.complete(item.id, interaction.user.id, item.version)
                : action === 'u' ? await manager.undo(item.id, interaction.user.id, item.version) : invalidSchedule();
            const rendered = renderSchedule(updated, locale);
            await interaction.editReply(rendered);
            await interaction.message.edit(rendered).catch(() => undefined);
        }
    } catch (error) {
        const payload = { content: scheduleFailure(error, locale), allowedMentions: { parse: [] as never[] } };
        if (interaction.deferred || interaction.replied || !modalAction) await interaction.editReply(payload);
        else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
    return true;
}

export async function handleModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('schedule:')) return false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await scheduleLocale(interaction);
    try {
        const { item, action } = await available(interaction);
        const value = interaction.fields.getTextInputValue('value');
        const manager = getConfigManager().userScheduleManager;
        let updated;
        if (action === 't') {
            const at = parseCompletedTime(value, item.timezone);
            if (at === null) invalidSchedule();
            updated = await manager.complete(item.id, interaction.user.id, item.version, at);
        } else if (action === 's') {
            const at = parseReminderTime(value, item.timezone);
            if (!at) invalidSchedule();
            updated = await manager.snooze(item.id, interaction.user.id, item.version, at.timestamp);
        } else if (action === 'n') updated = await manager.note(item.id, interaction.user.id, item.version, value);
        else invalidSchedule();
        const rendered = renderSchedule(updated, locale);
        await interaction.editReply(rendered);
        await interaction.message?.edit(rendered).catch(() => undefined);
    } catch (error) { await interaction.editReply({ content: scheduleFailure(error, locale), allowedMentions: { parse: [] } }); }
    return true;
}
