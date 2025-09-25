import {SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder} from 'discord.js';
import {getMatchHistory, getMatchDetails} from '../../../services/riotService.js';
import {leagueRegionChoices} from '../constants/leagueRegions.js';
import {getLeagueIdentityFromInteraction} from "../utils/leagueUtils.js";
import {regionToRegionGroupForAccountAPI} from "twisted/dist/constants/regions.js";
import {generateLeagueHistoryImage} from '../image/leagueHistoryImage.js';

const data = new SlashCommandBuilder()
    .setName('league-history')
    .setDescription('Get recent League of Legends match history for a summoner')
    .addStringOption(option =>
        option.setName('summoner')
            .setDescription('Summoner name or Riot ID (e.g. Zeffuro#EUW)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option.setName('region')
            .setDescription('Region')
            .setRequired(false)
            .addChoices(...leagueRegionChoices)
    )
    .addUserOption(option =>
        option.setName('user')
            .setDescription('Discord user')
            .setRequired(false)
    );


/**
 * Executes the league-history command, replying with a recent match history image for a summoner.
 * Handles errors and provides feedback if match history cannot be fetched.
 * Replies with an image attachment showing recent matches.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let identity;
    try {
        identity = await getLeagueIdentityFromInteraction(interaction);
    } catch {
        await interaction.editReply('Please provide a summoner name and region, or link your account first.');
        return;
    }

    const regionGroup = regionToRegionGroupForAccountAPI(identity.region);
    const matchHistoryResult = await getMatchHistory(identity.puuid, regionGroup, 0, 5);
    if (!matchHistoryResult.success) {
        await interaction.editReply(`Failed to fetch match history: ${matchHistoryResult.error}`);
        return;
    }
    const matchIds = matchHistoryResult.data as string[] | undefined;

    if (!Array.isArray(matchIds) || matchIds.length === 0) {
        await interaction.editReply('No match history found.');
        return;
    }

    const matches: import('twisted/dist/models-dto/matches/match-v5/match.dto.js').MatchV5DTOs.MatchDto[] = [];
    for (const matchId of matchIds) {
        const matchResult = await getMatchDetails(matchId, regionGroup);
        if (!matchResult.success || !matchResult.data) {
            await interaction.editReply(`Failed to fetch details for match ${matchId}: ${matchResult.error}`);
            return;
        }
        matches.push(matchResult.data as import('twisted/dist/models-dto/matches/match-v5/match.dto.js').MatchV5DTOs.MatchDto);
    }

    const buffer = await generateLeagueHistoryImage(matches, identity);
    const attachment = new AttachmentBuilder(buffer, {name: 'league-history.png'});

    await interaction.editReply({
        content: `Recent League matches for ${identity.summoner} [${identity.region}]`,
        files: [attachment]
    });
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};