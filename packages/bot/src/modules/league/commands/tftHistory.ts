import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getTftMatchHistory, getTftMatchDetails} from '../../../services/riotService.js';
import {generateTftHistoryImage} from '../image/tftHistoryImage.js';
import { runHistoryCommand } from '../shared/historyCommon.js';
import { buildCommonLeagueOptions } from '../shared/commandOptions.js';

const data = buildCommonLeagueOptions(
    new SlashCommandBuilder()
        .setName('tft-history')
        .setDescription('Get recent Teamfight Tactics match history for a summoner')
);

/**
 * Executes the tft-history command, replying with a recent TFT match history image for a summoner.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    await runHistoryCommand(interaction, {
        fetchHistory: getTftMatchHistory,
        fetchDetails: getTftMatchDetails,
        generateImage: generateTftHistoryImage,
        contentPrefix: 'Recent TFT matches',
        historyErrorPrefix: 'Failed to fetch TFT match history',
        detailsErrorPrefix: 'Failed to fetch details for match',
        count: 5,
    });
}

const testOnly = true;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};