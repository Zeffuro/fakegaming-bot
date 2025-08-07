import {SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder} from 'discord.js';
import {getTftMatchHistory, getTftMatchDetails} from '../../../services/riotService.js';
import {leagueRegionChoices} from '../../../constants/leagueRegions.js';
import {getLeagueIdentityFromInteraction} from "../../../utils/leagueUtils.js";
import {regionToRegionGroupForAccountAPI} from "twisted/dist/constants/regions.js";
import {generateTftHistoryImage} from '../image/tftHistoryImage.js';

export const data = new SlashCommandBuilder()
    .setName('tft-history')
    .setDescription('Get recent Teamfight Tactics match history for a summoner')
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

export const testOnly = true;

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
    const matchHistoryResult = await getTftMatchHistory(identity.puuid, regionGroup, 0, 5);
    if (!matchHistoryResult.success) {
        await interaction.editReply(`Failed to fetch TFT match history: ${matchHistoryResult.error}`);
        return;
    }
    const matchIds = matchHistoryResult.data;

    const matches = [];
    for (const matchId of matchIds) {
        const matchResult = await getTftMatchDetails(matchId, regionGroup);
        if (!matchResult.success) {
            await interaction.editReply(`Failed to fetch details for match ${matchId}: ${matchResult.error}`);
            return;
        }
        matches.push(matchResult.data);
    }

    const buffer = await generateTftHistoryImage(matches, identity);
    const attachment = new AttachmentBuilder(buffer, {name: 'tft-history.png'});

    await interaction.editReply({
        content: `Recent TFT matches for ${identity.summoner} [${identity.region}]`,
        files: [attachment]
    });
}
