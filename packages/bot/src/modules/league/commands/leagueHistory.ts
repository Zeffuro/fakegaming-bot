import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getMatchHistory, getMatchDetails} from '../../../services/riotService.js';
import {generateLeagueHistoryImage} from '../image/leagueHistoryImage.js';
import { runHistoryCommand } from '../shared/historyCommon.js';
import { buildCommonLeagueOptions } from '../shared/commandOptions.js';

const data = buildCommonLeagueOptions(
    new SlashCommandBuilder()
        .setName('league-history')
        .setDescription('Get recent League of Legends match history for a summoner')
);

async function execute(interaction: ChatInputCommandInteraction) {
    await runHistoryCommand(interaction, {
        fetchHistory: getMatchHistory,
        fetchDetails: getMatchDetails,
        generateImage: generateLeagueHistoryImage,
        contentPrefix: 'Recent League matches',
        historyErrorPrefix: 'Failed to fetch match history',
        detailsErrorPrefix: 'Failed to fetch details for match',
        count: 5,
    });
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};