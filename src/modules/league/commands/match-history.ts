import {SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import {getMatchHistory, getMatchDetails} from '../../../services/riotService.js';
import {leagueRegionChoices} from '../../../constants/leagueRegions.js';
import {getLeagueIdentityFromInteraction} from "../../../utils/leagueUtils.js";
import {regionToRegionGroupForAccountAPI} from "twisted/dist/constants/regions.js";

export const data = new SlashCommandBuilder()
    .setName('match-history')
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

    const matchIds = await getMatchHistory(identity.puuid, regionToRegionGroupForAccountAPI(identity.region), 0, 5);

    const embed = new EmbedBuilder()
        .setTitle(`Recent Matches for ${identity.summoner} [${identity.region}]`);

    for (const matchId of matchIds) {
        const match = await getMatchDetails(matchId, regionToRegionGroupForAccountAPI(identity.region));
        const participant = match.info.participants.find((p: any) => p.puuid === identity.puuid);
        if (participant) {
            embed.addFields({
                name: `Match: ${matchId}`,
                value: `Champion: ${participant.championName}\nKDA: ${participant.kills}/${participant.deaths}/${participant.assists}\nResult: ${participant.win ? 'Win' : 'Loss'}`,
                inline: false
            });
        }
    }

    await interaction.editReply({embeds: [embed]});
}