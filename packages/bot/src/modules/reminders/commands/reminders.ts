import {ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {reminders as META} from '../commands.manifest.js';
import {formatReminderLine} from '../shared/reminderFormat.js';
import {listVisibleRemindersForUser} from '../shared/reminderLookup.js';

const data = createSlashCommand(META);

async function execute(interaction: ChatInputCommandInteraction) {
    const reminders = await listVisibleRemindersForUser(interaction.user.id);

    if (reminders.length === 0) {
        await interaction.reply({content: 'You have no active or paused reminders.', flags: MessageFlags.Ephemeral});
        return;
    }

    const lines = reminders.slice(0, 10).map(formatReminderLine);
    const suffix = reminders.length > 10 ? `\n...and ${reminders.length - 10} more.` : '';
    await interaction.reply({
        content: `Your reminders:\n${lines.join('\n')}${suffix}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
