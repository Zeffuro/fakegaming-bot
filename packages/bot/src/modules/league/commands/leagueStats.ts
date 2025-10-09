import {SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import {getSummoner, getSummonerDetails} from '../../../services/riotService.js';
import {getLeagueIdentityFromInteraction} from "../utils/leagueUtils.js";
import type {LeagueEntryDTO} from 'twisted/dist/models-dto/league/league-exp/league-entry.dto.js';
import {leagueRegionChoices} from '../constants/leagueRegions.js';
import {getTierEmoji} from '../constants/leagueTierEmojis.js';

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
        if (!summonerResult.success || !summonerResult.data) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('League Stats')
                .setDescription(`Failed to fetch summoner: ${summonerResult.error}`);
            await interaction.editReply({embeds: [errorEmbed]});
            return;
        }
        const summonerData = summonerResult.data as { profileIconId?: number; summonerLevel?: number };

        const leagueResult = await getSummonerDetails(identity.puuid, identity.region);
        if (!leagueResult.success || !leagueResult.data) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('League Stats')
                .setDescription(`Failed to fetch ranked stats: ${leagueResult.error}`);
            await interaction.editReply({embeds: [errorEmbed]});
            return;
        }
        const leagueEntries = leagueResult.data as LeagueEntryDTO[];

        const embed = new EmbedBuilder()
            .setTitle(`Stats for ${identity.summoner} [${identity.region}]`)
            .setThumbnail(`https://raw.communitydragon.org/latest/game/assets/ux/summonericons/profileicon${summonerData.profileIconId ?? 0}.png`)
            .addFields(
                {name: 'Level', value: `${summonerData.summonerLevel ?? 'N/A'}`, inline: true}
            );

        if (Array.isArray(leagueEntries) && leagueEntries.length > 0) {
            leagueEntries.forEach((entry: LeagueEntryDTO) => {
                const emoji = getTierEmoji(interaction.guild, (entry as any).tier as string);
                let value = `**${(entry as any).tier} ${(entry as any).rank}** ${emoji} (${(entry as any).leaguePoints} LP)\nWins: ${(entry as any).wins}, Losses: ${(entry as any).losses}`;
                if ((entry as any).miniSeries) {
                    const ms = (entry as any).miniSeries as { progress?: string; wins?: number; losses?: number; target?: number };
                    value += `\nPromos: ${ms.progress ?? ''} (${ms.wins ?? 0}W/${ms.losses ?? 0}L, Target: ${ms.target ?? 0})`;
                }
                embed.addFields({name: (entry as any).queueType as string, value, inline: false});
            });
        } else {
            embed.addFields({name: 'Ranked', value: 'No ranked data found.', inline: false});
        }

        await interaction.editReply({embeds: [embed]});
    } catch {
        const errorEmbed = new EmbedBuilder()
            .setTitle('League Stats')
            .setDescription('Failed to fetch stats. Please check the Riot ID and region.');
        await interaction.editReply({embeds: [errorEmbed]});
    }
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};