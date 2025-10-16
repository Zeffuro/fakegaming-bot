import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction
} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {loadPatchNoteFetchers} from "../../../loaders/loadPatchNoteFetchers.js";
import {buildPatchNoteEmbed} from '../shared/patchNoteEmbed.js';
import {gameAutocomplete} from '../shared/gameAutocomplete.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { getPatchnotes as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option => option.setName('game').setDescription('Game to get patch notes for').setRequired(true).setAutocomplete(true))
);

async function execute(interaction: ChatInputCommandInteraction) {
    const game = interaction.options.getString('game', true);
    const latestPatch = await getConfigManager().patchNotesManager.getLatestPatch(game);

    if (latestPatch) {
        await interaction.reply({embeds: [buildPatchNoteEmbed(latestPatch)]});
    } else {
        const fetchers = await loadPatchNoteFetchers();
        const fetcher = fetchers.find(f => f.game === game);
        if (!fetcher) {
            await interaction.reply(`No patch notes fetcher found for \`${game}\`.`);
            return;
        }
        const patch = await fetcher.fetchLatestPatchNote();
        if (patch) {
            await interaction.reply({embeds: [buildPatchNoteEmbed(patch)]});
        } else {
            await interaction.reply(`No patch notes found for \`${game}\`.`);
        }
    }
}

async function autocomplete(interaction: AutocompleteInteraction) {
    await gameAutocomplete(interaction);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly, autocomplete};