import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {calendar as META} from '../commands.manifest.js';
import {formatBirthdayLine, getUpcomingBirthdays, type BirthdayRow} from '../../birthdays/shared/upcomingBirthdays.js';
import {formatReminderLine, type ReminderLike} from '../../reminders/shared/reminderFormat.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addIntegerOption(option =>
        option
            .setName('days')
            .setDescription('How many days ahead to show')
            .setMinValue(1)
            .setMaxValue(366)
            .setRequired(false)
    )
);

function timestampValue(reminder: ReminderLike): number {
    return typeof reminder.timestamp === 'string' ? Number(reminder.timestamp) : reminder.timestamp;
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({content: 'Calendar only works in a server.', flags: MessageFlags.Ephemeral});
        return;
    }

    const days = interaction.options.getInteger('days') ?? 30;
    const now = new Date();
    const cutoffMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days + 1).getTime();
    const [birthdayRows, reminderRows] = await Promise.all([
        getConfigManager().birthdayManager.getAllPlain() as Promise<BirthdayRow[]>,
        getConfigManager().reminderManager.getRemindersByUser(interaction.user.id) as unknown as Promise<ReminderLike[]>,
    ]);

    const birthdays = getUpcomingBirthdays(birthdayRows, guildId, days, now, 8);
    const reminders = reminderRows
        .filter(row => {
            const timestamp = timestampValue(row);
            return Number.isFinite(timestamp) && timestamp > Date.now() && timestamp < cutoffMs;
        })
        .sort((a, b) => timestampValue(a) - timestampValue(b))
        .slice(0, 8);

    const sections: string[] = [];
    if (birthdays.length > 0) {
        sections.push(`**Birthdays**\n${birthdays.map(item => formatBirthdayLine(item.row, item.date, now)).join('\n')}`);
    }
    if (reminders.length > 0) {
        sections.push(`**Your Reminders**\n${reminders.map(formatReminderLine).join('\n')}`);
    }

    if (sections.length === 0) {
        await interaction.reply({
            content: `No birthdays or reminders in the next ${days} days.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        content: `Upcoming calendar for the next ${days} days:\n\n${sections.join('\n\n')}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
