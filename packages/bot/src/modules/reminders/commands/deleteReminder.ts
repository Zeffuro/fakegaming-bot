import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {deleteReminder as META} from '../commands.manifest.js';
import {autocompleteReminderIds} from '../shared/reminderAutocomplete.js';
import {shortReminderId} from '../shared/reminderFormat.js';
import {resolvePendingReminderForUser} from '../shared/reminderLookup.js';

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
    const reminder = await resolvePendingReminderForUser(interaction.user.id, input);

    if (!reminder) {
        await interaction.reply({content: 'Reminder not found. Use `/reminders` to see your pending reminders.', flags: MessageFlags.Ephemeral});
        return;
    }

    await getConfigManager().reminderManager.removeReminder(reminder.id);
    await interaction.reply({
        content: `Deleted reminder \`${shortReminderId(reminder.id)}\`: ${reminder.message}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await autocompleteReminderIds(interaction, 'pending');
}

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
