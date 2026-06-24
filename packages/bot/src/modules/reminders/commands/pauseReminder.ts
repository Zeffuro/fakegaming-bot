import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {pauseReminder as META} from '../commands.manifest.js';
import {autocompleteReminderIds} from '../shared/reminderAutocomplete.js';
import {isReminderPaused, shortReminderId} from '../shared/reminderFormat.js';
import {resolveReminderForUser} from '../shared/reminderLookup.js';
import {getReminderRecurrenceRule} from '../shared/reminderState.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option =>
        option
            .setName('reminder')
            .setDescription('Reminder number from /reminders or its short ID')
            .setRequired(true)
            .setAutocomplete(true)
    )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const input = interaction.options.getString('reminder', true);
    const reminder = await resolveReminderForUser(interaction.user.id, input);

    if (!reminder) {
        await interaction.reply({content: 'Reminder not found. Use `/reminders` to see your reminders.', flags: MessageFlags.Ephemeral});
        return;
    }

    const recurrenceRule = getReminderRecurrenceRule(reminder);
    if (!recurrenceRule) {
        await interaction.reply({content: 'Only recurring reminders can be paused.', flags: MessageFlags.Ephemeral});
        return;
    }

    if (isReminderPaused(reminder)) {
        await interaction.reply({content: `Reminder \`${shortReminderId(reminder.id)}\` is already paused.`, flags: MessageFlags.Ephemeral});
        return;
    }

    await getConfigManager().reminderManager.setPausedForUser(reminder.id, interaction.user.id, {paused: true});
    await interaction.reply({
        content: `Paused recurring reminder \`${shortReminderId(reminder.id)}\`: ${reminder.message}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await autocompleteReminderIds(interaction, 'active-recurring');
}

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
