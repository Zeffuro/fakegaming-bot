import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {birthdays as META} from '../commands.manifest.js';
import {formatBirthdayLine, getUpcomingBirthdays, type BirthdayRow} from '../shared/upcomingBirthdays.js';

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

async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== 'upcoming') {
        await interaction.reply({content: 'Unknown birthdays subcommand.', flags: MessageFlags.Ephemeral});
        return;
    }

    const days = interaction.options.getInteger('days') ?? 30;
    const now = new Date();
    const rows = await getConfigManager().birthdayManager.getAllPlain() as BirthdayRow[];
    const upcoming = getUpcomingBirthdays(rows, interaction.guildId, days, now, 15);

    if (upcoming.length === 0) {
        await interaction.reply({content: `No birthdays in the next ${days} days.`, flags: MessageFlags.Ephemeral});
        return;
    }

    await interaction.reply({
        content: `Upcoming birthdays in the next ${days} days:\n${upcoming.map(item => formatBirthdayLine(item.row, item.date, now)).join('\n')}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
