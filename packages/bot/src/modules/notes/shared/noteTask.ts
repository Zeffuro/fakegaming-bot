import { ActionRowBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction, type ModalSubmitInteraction } from 'discord.js';
import { getConfigManager, PersonalError } from '@zeffuro/fakegaming-common/managers';
import { getNotesCopy } from '../copy/notesCopy.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { renderTask } from '../../personal/commands/tasks.js';
import { personalTimezone } from '../../personal/shared/personalCopy.js';

const TASK_ID = /^notes:task:([0-9a-f-]{36})$/i;

export async function openNoteTask(interaction: ButtonInteraction): Promise<boolean> {
    const locale = await resolveInteractionOutputLocale({ guildId: null, user: interaction.user, locale: interaction.locale });
    const copy = getNotesCopy(locale);
    try {
        const id = TASK_ID.exec(interaction.customId)?.[1];
        const manager = getConfigManager();
        const note = id ? await manager.userNoteManager.getForUser(id, interaction.user.id) : null;
        if (!note) throw new PersonalError('missing');
        if (note.linkedTaskId) {
            const task = await manager.userTaskManager.get(note.linkedTaskId, interaction.user.id);
            if (!task) throw new PersonalError('stale');
            await interaction.reply({ ...renderTask(task, locale), flags: MessageFlags.Ephemeral });
            return true;
        }
        const timezone = await personalTimezone(interaction.user.id);
        const title = new TextInputBuilder().setCustomId('title').setLabel(copy.task.titleLabel)
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(120).setValue(note.title.slice(0, 120));
        const due = new TextInputBuilder().setCustomId('due').setLabel(copy.task.dueLabel)
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100).setPlaceholder(copy.task.duePlaceholder);
        const zone = new TextInputBuilder().setCustomId('timezone').setLabel(copy.task.timezoneLabel)
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue(timezone);
        await interaction.showModal(new ModalBuilder().setCustomId(interaction.customId).setTitle(copy.task.modalTitle)
            .addComponents([title, due, zone].map(input => new ActionRowBuilder<TextInputBuilder>().addComponents(input))));
    } catch (error) {
        await interaction.reply({ content: error instanceof PersonalError && error.code === 'missing' ? copy.notFound
            : error instanceof PersonalError && error.code === 'stale' ? copy.task.deleted : copy.task.failed, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
    return true;
}

export async function handleNoteTaskModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('notes:task:')) return false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await resolveInteractionOutputLocale({ guildId: null, user: interaction.user, locale: interaction.locale });
    const copy = getNotesCopy(locale);
    try {
        const id = TASK_ID.exec(interaction.customId)?.[1];
        if (!id) throw new PersonalError('missing');
        const timezone = await personalTimezone(interaction.user.id);
        if (interaction.fields.getTextInputValue('timezone').trim() !== timezone) throw new PersonalError('invalid');
        const result = await getConfigManager().userTaskManager.fromNote({ userId: interaction.user.id, noteId: id,
            title: interaction.fields.getTextInputValue('title'), due: interaction.fields.getTextInputValue('due'), timezone });
        const rendered = renderTask(result.task, locale);
        await interaction.editReply({ ...rendered, content: `${result.created ? copy.task.created : copy.task.existing}\n${rendered.content}` });
    } catch (error) {
        const content = error instanceof PersonalError ? error.code === 'missing' ? copy.notFound
            : error.code === 'stale' ? copy.task.deleted : error.code === 'capacity' ? copy.task.capacity : copy.task.invalid : copy.task.failed;
        await interaction.editReply({ content, allowedMentions: { parse: [] } });
    }
    return true;
}
