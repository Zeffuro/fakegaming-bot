import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {pauseReminder as META} from '../commands.manifest.js';
import {autocompleteReminderIds} from '../shared/reminderAutocomplete.js';
import {isReminderPaused, shortReminderId} from '../shared/reminderFormat.js';
import {resolveReminderForUser} from '../shared/reminderLookup.js';
import {getReminderRecurrenceRule} from '../shared/reminderState.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {getReminderCopy} from '../copy/reminderCopy.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option =>
        option
            .setName('reminder')
            .setNameLocalization('nl', 'herinnering')
            .setDescription('Reminder number from /reminders or its short ID')
            .setDescriptionLocalization('nl', 'Nummer uit /herinneringen of het korte ID')
            .setRequired(true)
            .setAutocomplete(true)
    )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const copy = getReminderCopy(await resolveInteractionOutputLocale(interaction));
    const input = interaction.options.getString('reminder', true);
    const reminder = await resolveReminderForUser(interaction.user.id, input);

    if (!reminder) {
        await interaction.reply({content: copy.notFound, flags: MessageFlags.Ephemeral});
        return;
    }

    const recurrenceRule = getReminderRecurrenceRule(reminder);
    if (!recurrenceRule) {
        await interaction.reply({content: copy.recurringOnlyPause, flags: MessageFlags.Ephemeral});
        return;
    }

    if (isReminderPaused(reminder)) {
        await interaction.reply({content: copy.alreadyPaused(shortReminderId(reminder.id)), flags: MessageFlags.Ephemeral});
        return;
    }

    await getConfigManager().reminderManager.setPausedForUser(reminder.id, interaction.user.id, {paused: true});
    await interaction.reply({
        content: copy.paused(shortReminderId(reminder.id), reminder.message),
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await autocompleteReminderIds(interaction, 'active-recurring', await resolveInteractionOutputLocale(interaction));
}

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
