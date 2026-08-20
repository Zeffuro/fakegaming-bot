import {ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {reminders as META} from '../commands.manifest.js';
import {formatReminderLine} from '../shared/reminderFormat.js';
import {listVisibleRemindersForUser} from '../shared/reminderLookup.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {getReminderCopy} from '../copy/reminderCopy.js';

const data = createSlashCommand(META);

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getReminderCopy(locale);
    const reminders = await listVisibleRemindersForUser(interaction.user.id);

    if (reminders.length === 0) {
        await interaction.reply({content: copy.none, flags: MessageFlags.Ephemeral});
        return;
    }

    const lines = reminders.slice(0, 10).map((reminder, index) => formatReminderLine(reminder, index, locale));
    const suffix = reminders.length > 10 ? copy.more(reminders.length - 10) : '';
    await interaction.reply({
        content: `${copy.title}\n${lines.join('\n')}${suffix}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
