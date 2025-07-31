import {SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder} from 'discord.js';
import {getMatchHistory, getMatchDetails} from '../../../services/riotService.js';
import {leagueRegionChoices} from '../../../constants/leagueRegions.js';
import {getLeagueIdentityFromInteraction} from "../../../utils/leagueUtils.js";
import {regionToRegionGroupForAccountAPI} from "twisted/dist/constants/regions.js";
import {getAsset} from "../../../utils/assetCache.js";
import {fileURLToPath} from 'url';
import path from 'path';
import {generateLeagueHistoryImage} from '../image/leagueHistoryImage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const data = new SlashCommandBuilder()
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

export const testOnly = false;

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let identity;
    try {
        identity = await getLeagueIdentityFromInteraction(interaction);
    } catch (error) {
        await interaction.editReply('Please provide a summoner name and region, or link your account first.');
        return;
    }

    const regionGroup = regionToRegionGroupForAccountAPI(identity.region);
    const matchIds = await getMatchHistory(identity.puuid, regionGroup, 0, 5);

    const matches = [];
    for (const matchId of matchIds) {
        const match = await getMatchDetails(matchId, regionGroup);
        matches.push(match);
    }

    const buffer = await generateLeagueHistoryImage(matches, identity);
    const attachment = new AttachmentBuilder(buffer, {name: 'league-history.png'});

    await interaction.editReply({
        content: `Recent matches for ${identity.summoner} [${identity.region}]`,
        files: [attachment]
    });
}