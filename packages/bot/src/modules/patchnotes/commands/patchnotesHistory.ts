import {SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {patchnotesHistory as META} from '../commands.manifest.js';
import {gameAutocomplete} from '../shared/gameAutocomplete.js';
import {buildPatchNoteEmbed} from '../shared/patchNoteEmbed.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option =>
            option
                .setName('game')
                .setDescription('Game to show patch history for')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option
                .setName('count')
                .setDescription('Number of stored patches to show')
                .setMinValue(1)
                .setMaxValue(5)
                .setRequired(false)
        )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const game = interaction.options.getString('game', true);
    const count = interaction.options.getInteger('count') ?? 3;
    const history = await getConfigManager().patchNoteHistoryManager.getHistory(game, count);

    if (history.length === 0) {
        await interaction.reply(`No stored patch history found for \`${game}\` yet.`);
        return;
    }

    await interaction.reply({
        content: `Stored patch history for ${game}:`,
        embeds: history.map(note => buildPatchNoteEmbed(note)),
    });
}

async function autocomplete(interaction: AutocompleteInteraction) {
    await gameAutocomplete(interaction);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
