import {ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import {getSummoner, getSummonerDetails} from '../../../services/riotService.js';
import {getLeagueIdentityFromInteraction} from "../utils/leagueUtils.js";
import type {LeagueEntryDto} from '../types/riotDtos.js';
import {getTierEmoji} from '../constants/leagueTierEmojis.js';
import { buildCommonLeagueOptions } from '../shared/commandOptions.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { leagueStats as META } from '../commands.manifest.js';

const data = buildCommonLeagueOptions(
    createSlashCommand(META)
);

/**
 * Executes the league-stats command, replying with a Discord embed of League stats for a Riot ID or linked user.
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
        const leagueEntries = leagueResult.data as LeagueEntryDto[];

        const embed = new EmbedBuilder()
            .setTitle(`Stats for ${identity.summoner} [${identity.region}]`)
            .setThumbnail(`https://raw.communitydragon.org/latest/game/assets/ux/summonericons/profileicon${summonerData.profileIconId ?? 0}.png`)
            .addFields(
                {name: 'Level', value: `${summonerData.summonerLevel ?? 'N/A'}`, inline: true}
            );

        if (Array.isArray(leagueEntries) && leagueEntries.length > 0) {
            leagueEntries.forEach((entry: LeagueEntryDto) => {
                const emoji = getTierEmoji(interaction.guild, entry.tier);
                let value = `**${entry.tier} ${entry.rank}** ${emoji} (${entry.leaguePoints} LP)\nWins: ${entry.wins}, Losses: ${entry.losses}`;
                if (entry.miniSeries) {
                    const ms = entry.miniSeries;
                    value += `\nPromos: ${ms.progress ?? ''} (${ms.wins ?? 0}W/${ms.losses ?? 0}L, Target: ${ms.target ?? 0})`;
                }
                embed.addFields({name: entry.queueType, value, inline: false});
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

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
