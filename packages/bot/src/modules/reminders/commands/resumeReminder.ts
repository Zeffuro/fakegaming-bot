import { runtimeText } from '../../../core/runtimeCopy.js';
import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {resumeReminder as META} from '../commands.manifest.js';
import {autocompleteReminderIds} from '../shared/reminderAutocomplete.js';
import {isReminderPaused, shortReminderId} from '../shared/reminderFormat.js';
import {resolveReminderForUser} from '../shared/reminderLookup.js';
import {getReminderRecurrenceRule, getResumeTimestamp} from '../shared/reminderState.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {getReminderCopy} from '../copy/reminderCopy.js';

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
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getReminderCopy(locale);
    const input = interaction.options.getString('reminder', true);
    const reminder = await resolveReminderForUser(interaction.user.id, input);

    if (!reminder) {
        await interaction.reply({content: copy.notFound, flags: MessageFlags.Ephemeral});
        return;
    }

    const recurrenceRule = getReminderRecurrenceRule(reminder);
    if (!recurrenceRule) {
        await interaction.reply({content: copy.recurringOnlyResume, flags: MessageFlags.Ephemeral});
        return;
    }

    if (!isReminderPaused(reminder)) {
        await interaction.reply({content: copy.alreadyActive(shortReminderId(reminder.id)), flags: MessageFlags.Ephemeral});
        return;
    }

    const timestamp = getResumeTimestamp(reminder, recurrenceRule);
    await getConfigManager().reminderManager.setPausedForUser(reminder.id, interaction.user.id, {
        paused: false,
        ...(timestamp !== undefined ? {timestamp} : {}),
    });

    const nextRun = timestamp !== undefined
        ? runtimeText(locale, 'reminders', 'nextRun', {timestamp: Math.floor(timestamp / 1000)})
        : '';
    await interaction.reply({
        content: copy.resumed(shortReminderId(reminder.id), reminder.message, nextRun),
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await autocompleteReminderIds(interaction, 'paused-recurring', await resolveInteractionOutputLocale(interaction));
}

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
