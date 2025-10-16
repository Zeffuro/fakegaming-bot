import type { ChatInputCommandInteraction } from 'discord.js';
import { getTestOnly } from '../../../core/commandBuilder.js';
import {getMatchHistory, getMatchDetails} from '../../../services/riotService.js';
import {generateLeagueHistoryImage} from '../image/leagueHistoryImage.js';
import { runHistoryCommand } from '../shared/historyCommon.js';
import { buildCommonLeagueOptions } from '../shared/commandOptions.js';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import { leagueHistory as META } from '../commands.manifest.js';

const data = buildCommonLeagueOptions(
    createSlashCommand(META)
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
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

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};