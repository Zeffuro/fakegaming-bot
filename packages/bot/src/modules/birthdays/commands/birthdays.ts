import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {getBirthdayCopy} from '../copy/birthdayCopy.js';
import {birthdays as META} from '../commands.manifest.js';
import {formatBirthdayLine, getUpcomingBirthdays, type BirthdayRow} from '../shared/upcomingBirthdays.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addSubcommand(subcommand =>
        subcommand
            .setName('upcoming')
            .setNameLocalization('nl', 'komend')
            .setDescription('Show upcoming birthdays in this server')
            .setDescriptionLocalization('nl', 'Toon komende verjaardagen op deze server')
            .addIntegerOption(option =>
                option
                    .setName('days')
                    .setNameLocalization('nl', 'dagen')
                    .setDescription('How many days ahead to show')
                    .setDescriptionLocalization('nl', 'Hoeveel dagen vooruit je wilt bekijken')
                    .setMinValue(1)
                    .setMaxValue(366)
                    .setRequired(false)
            )
    )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getBirthdayCopy(locale);
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== 'upcoming') {
        await interaction.reply({content: copy.unknownSubcommand, flags: MessageFlags.Ephemeral});
        return;
    }

    const days = interaction.options.getInteger('days') ?? 30;
    const now = new Date();
    const rows = await getConfigManager().birthdayManager.getAllPlain() as BirthdayRow[];
    const upcoming = getUpcomingBirthdays(rows, interaction.guildId, days, now, 15);

    if (upcoming.length === 0) {
        await interaction.reply({content: copy.noneUpcoming(days), flags: MessageFlags.Ephemeral});
        return;
    }

    await interaction.reply({
        content: `${copy.upcoming(days)}\n${upcoming.map(item => formatBirthdayLine(item.row, item.date, now, locale)).join('\n')}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
