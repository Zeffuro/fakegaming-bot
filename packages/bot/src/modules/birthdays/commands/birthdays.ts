import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {months} from '../../../constants/months.js';
import {birthdays as META} from '../commands.manifest.js';

interface BirthdayRow {
    day: number;
    month: number;
    year?: number | null;
    userId: string;
    guildId: string;
}

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addSubcommand(subcommand =>
        subcommand
            .setName('upcoming')
            .setDescription('Show upcoming birthdays in this server')
            .addIntegerOption(option =>
                option
                    .setName('days')
                    .setDescription('How many days ahead to show')
                    .setMinValue(1)
                    .setMaxValue(366)
                    .setRequired(false)
            )
    )
);

function nextBirthdayDate(row: BirthdayRow, now: Date): Date {
    const currentYear = now.getFullYear();
    const makeDate = (year: number) => new Date(year, row.month - 1, row.day, 12, 0, 0, 0);
    let next = makeDate(currentYear);
    if (next.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
        next = makeDate(currentYear + 1);
    }

    if (row.month === 2 && row.day === 29 && next.getMonth() !== 1) {
        next = new Date(next.getFullYear(), 1, 28, 12, 0, 0, 0);
    }

    return next;
}

function formatBirthday(row: BirthdayRow, date: Date, now: Date): string {
    const unix = Math.floor(date.getTime() / 1000);
    const age = row.year ? date.getFullYear() - row.year : null;
    const ageText = age && age > 0 ? `, turns ${age}` : '';
    const today = date.toDateString() === now.toDateString();
    const relative = today ? 'today' : `<t:${unix}:R>`;
    return `<@${row.userId}> - ${row.day} ${months[row.month - 1].name}${ageText} (${relative})`;
}

async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== 'upcoming') {
        await interaction.reply({content: 'Unknown birthdays subcommand.', flags: MessageFlags.Ephemeral});
        return;
    }

    const days = interaction.options.getInteger('days') ?? 30;
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days + 1);
    const rows = await getConfigManager().birthdayManager.getAllPlain() as BirthdayRow[];
    const upcoming = rows
        .filter(row => row.guildId === interaction.guildId)
        .map(row => ({row, date: nextBirthdayDate(row, now)}))
        .filter(item => item.date < cutoff)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 15);

    if (upcoming.length === 0) {
        await interaction.reply({content: `No birthdays in the next ${days} days.`, flags: MessageFlags.Ephemeral});
        return;
    }

    await interaction.reply({
        content: `Upcoming birthdays in the next ${days} days:\n${upcoming.map(item => formatBirthday(item.row, item.date, now)).join('\n')}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
