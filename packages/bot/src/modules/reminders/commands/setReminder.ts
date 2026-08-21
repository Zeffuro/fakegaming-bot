import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {parseReminderRecurrence, parseTimespan} from '@zeffuro/fakegaming-common/utils';
import {v4 as uuidv4} from 'uuid';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {setReminder as META} from '../commands.manifest.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {getReminderCopy} from '../copy/reminderCopy.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option => option.setName('timespan').setDescription('When to remind (e.g., 1h, 30m)').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('Reminder message').setRequired(true))
        .addStringOption(option => option.setName('repeat').setDescription('Optional repeat rule, e.g. daily, weekly, every 2 weeks').setRequired(false))
        .addStringOption(option => option.setName('repeat-timezone').setDescription('Timezone for repeats; defaults to your saved timezone').setRequired(false))
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const copy = getReminderCopy(await resolveInteractionOutputLocale(interaction));
    const timespan = interaction.options.getString('timespan', true);
    const message = interaction.options.getString('message', true);
    const repeat = interaction.options.getString('repeat', false)?.trim() ?? '';
    const repeatTimezoneInput = interaction.options.getString('repeat-timezone', false)?.trim() ?? '';
    const userId = interaction.user.id;

    const ms = parseTimespan(timespan);
    if (ms === null || ms <= 0) {
        await interaction.reply(copy.invalidTimespan);
        return;
    }

    const timestamp = Date.now() + ms;
    const savedTimezone = repeat && !repeatTimezoneInput
        ? (await getConfigManager().userManager.getUser({discordId: userId}))?.timezone?.trim() ?? ''
        : '';
    const repeatTimezone = repeatTimezoneInput || savedTimezone;
    const recurrence = repeat ? parseReminderRecurrence(repeat, repeatTimezone) : null;
    if (repeat && !recurrence) {
        await interaction.reply({
            content: copy.invalidRepeat,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await getConfigManager().reminderManager.addReminder({
        id: uuidv4(),
        userId,
        message,
        timespan,
        timestamp,
        recurrenceUnit: recurrence?.unit ?? null,
        recurrenceInterval: recurrence?.interval ?? null,
        recurrenceTimezone: recurrence?.timezone ?? null,
        lastTriggeredAt: null,
    });

    const repeatText = recurrence
        ? copy.repeat(recurrence.interval, recurrence.unit, recurrence.timezone)
        : '';
    await interaction.reply({
        content: copy.set(timespan, message, Math.floor(timestamp / 1000), repeatText),
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
