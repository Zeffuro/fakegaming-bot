import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {parseTimespan} from '@zeffuro/fakegaming-common/utils';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {snoozeReminder as META} from '../commands.manifest.js';
import {autocompleteReminderIds} from '../shared/reminderAutocomplete.js';
import {shortReminderId} from '../shared/reminderFormat.js';
import {resolvePendingReminderForUser} from '../shared/reminderLookup.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {getReminderCopy} from '../copy/reminderCopy.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option =>
            option
                .setName('reminder')
                .setNameLocalization('nl', 'herinnering')
                .setDescription('Reminder number from /reminders or its short ID')
                .setDescriptionLocalization('nl', 'Nummer uit /herinneringen of het korte ID')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('timespan')
                .setNameLocalization('nl', 'tijdsduur')
                .setDescription('How long to snooze for, e.g. 10m or 2h')
                .setDescriptionLocalization('nl', 'Hoe lang je wilt uitstellen, bijv. 10m of 2h')
                .setRequired(true)
        )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const copy = getReminderCopy(await resolveInteractionOutputLocale(interaction));
    const input = interaction.options.getString('reminder', true);
    const timespan = interaction.options.getString('timespan', true);
    const delayMs = parseTimespan(timespan);

    if (delayMs === null || delayMs <= 0) {
        await interaction.reply({content: copy.invalidSnooze, flags: MessageFlags.Ephemeral});
        return;
    }

    const reminder = await resolvePendingReminderForUser(interaction.user.id, input);

    if (!reminder) {
        await interaction.reply({content: copy.pendingNotFound, flags: MessageFlags.Ephemeral});
        return;
    }

    const timestamp = Date.now() + delayMs;
    await getConfigManager().reminderManager.updatePlain({timestamp, timespan} as any, {id: reminder.id} as any);
    await interaction.reply({
        content: copy.snoozed(shortReminderId(reminder.id), Math.floor(timestamp / 1000)),
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await autocompleteReminderIds(interaction, 'pending', await resolveInteractionOutputLocale(interaction));
}

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
