import {SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import {getSummoner, getSummonerDetails} from '../../../services/riotService.js';
import {getLeagueIdentityFromInteraction} from "../utils/leagueUtils.js";

import {leagueRegionChoices} from '../constants/leagueRegions.js';
import {tierEmojis} from '../constants/leagueTierEmojis.js';

const data = new SlashCommandBuilder()
    .setName('league-stats')
    .setDescription('Get League of Legends stats for a summoner or linked user')
    .addStringOption(option =>
        option.setName('summoner')
            .setDescription('Riot ID (e.g. Zeffuro#EUW)')
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
 * Executes the league-stats command, replying with a Discord embed of League stats for a summoner or linked user.
 * Handles errors and provides feedback if stats cannot be fetched.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let identity;
    try {
        identity = await getLeagueIdentityFromInteraction(interaction);
    } catch {
        await interaction.editReply('Please provide a Riot ID and region, or link your account first.');
        return;
    }

    try {
        const summonerResult = await getSummoner(identity.puuid, identity.region);
        if (!summonerResult.success) {
            await interaction.editReply(`Failed to fetch summoner: ${summonerResult.error}`);
            return;
        }
        const summonerData = summonerResult.data;

        const leagueResult = await getSummonerDetails(identity.puuid, identity.region);
        if (!leagueResult.success) {
            await interaction.editReply(`Failed to fetch ranked stats: ${leagueResult.error}`);
            return;
        }
        const leagueEntries = leagueResult.data;

        const embed = new EmbedBuilder()
            .setTitle(`Stats for ${identity.summoner} [${identity.region}]`)
            .setThumbnail(`https://raw.communitydragon.org/latest/game/assets/ux/summonericons/profileicon${summonerData.profileIconId}.png`)
            .addFields(
                {name: 'Level', value: `${summonerData.summonerLevel}`, inline: true}
            );

        if (leagueEntries && leagueEntries.length > 0) {
            leagueEntries.forEach((entry: any) => {
                const emoji = tierEmojis[entry.tier] || '';
                let value = `**${entry.tier} ${entry.rank}** ${emoji} (${entry.leaguePoints} LP)\nWins: ${entry.wins}, Losses: ${entry.losses}`;
                if (entry.miniSeries) {
                    value += `\nPromos: ${entry.miniSeries.progress} (${entry.miniSeries.wins}W/${entry.miniSeries.losses}L, Target: ${entry.miniSeries.target})`;
                }
                embed.addFields({name: entry.queueType, value, inline: false});
            });
        } else {
            embed.addFields({name: 'Ranked', value: 'No ranked data found.', inline: false});
        }

        await interaction.editReply({embeds: [embed]});
    } catch {
        await interaction.editReply('Failed to fetch stats. Please check the Riot ID and region.');
    }
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};