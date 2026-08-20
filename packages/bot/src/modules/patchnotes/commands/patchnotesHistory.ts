import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {patchnotesHistory as META} from '../commands.manifest.js';
import {gameAutocomplete} from '../shared/gameAutocomplete.js';
import {buildPatchNoteEmbed} from '../shared/patchNoteEmbed.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option =>
            option
                .setName('game')
                .setNameLocalization('nl', 'spel')
                .setDescription('Game to show patch history for')
                .setDescriptionLocalization('nl', 'Spel waarvoor je patchnote-geschiedenis wilt tonen')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option
                .setName('count')
                .setNameLocalization('nl', 'aantal')
                .setDescription('Number of stored patches to show')
                .setDescriptionLocalization('nl', 'Aantal opgeslagen patches om te tonen')
                .setMinValue(1)
                .setMaxValue(5)
                .setRequired(false)
        )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const game = interaction.options.getString('game', true);
    const count = interaction.options.getInteger('count') ?? 3;
    const history = await getConfigManager().patchNoteHistoryManager.getHistory(game, count);

    if (history.length === 0) {
        await interaction.reply(resolveLocaleValue(locale, { en: `No stored patch history found for \`${game}\` yet.`, nl: `Nog geen opgeslagen patchnote-geschiedenis gevonden voor \`${game}\`.` }));
        return;
    }

    await interaction.reply({
        content: resolveLocaleValue(locale, { en: `Stored patch history for ${game}:`, nl: `Opgeslagen patchnote-geschiedenis voor ${game}:` }),
        embeds: history.map(note => resolveLocaleValue(locale, { en: buildPatchNoteEmbed(note), nl: buildPatchNoteEmbed(note, locale) })),
    });
}

async function autocomplete(interaction: AutocompleteInteraction) {
    await gameAutocomplete(interaction);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
