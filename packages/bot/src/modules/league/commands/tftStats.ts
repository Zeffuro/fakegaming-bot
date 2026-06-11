import {ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import {getTftLeagueEntries, getTftSummoner} from '../../../services/riotService.js';
import {getLeagueIdentityFromInteraction} from '../utils/leagueUtils.js';
import {getTierEmoji} from '../constants/leagueTierEmojis.js';
import {buildCommonLeagueOptions} from '../shared/commandOptions.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {tftStats as META} from '../commands.manifest.js';

interface TftLeagueEntry {
    queueType?: string;
    tier?: string;
    rank?: string;
    leaguePoints?: number;
    wins?: number;
    losses?: number;
}

const data = buildCommonLeagueOptions(
    createSlashCommand(META)
);

async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let identity;
    try {
        identity = await getLeagueIdentityFromInteraction(interaction);
    } catch {
        await interaction.editReply('Please provide a Riot ID and region, or link your account first.');
        return;
    }

    const summonerResult = await getTftSummoner(identity.puuid, identity.region);
    if (!summonerResult.success || !summonerResult.data) {
        await interaction.editReply(`Failed to fetch TFT summoner: ${summonerResult.error ?? 'Unknown error'}`);
        return;
    }

    const leagueResult = await getTftLeagueEntries(identity.puuid, identity.region);
    if (!leagueResult.success || !leagueResult.data) {
        await interaction.editReply(`Failed to fetch TFT ranked stats: ${leagueResult.error ?? 'Unknown error'}`);
        return;
    }

    const summoner = summonerResult.data as { profileIconId?: number; summonerLevel?: number };
    const entries = leagueResult.data as TftLeagueEntry[];
    const embed = new EmbedBuilder()
        .setTitle(`TFT Stats for ${identity.summoner} [${identity.region}]`)
        .setThumbnail(`https://raw.communitydragon.org/latest/game/assets/ux/summonericons/profileicon${summoner.profileIconId ?? 0}.png`)
        .addFields({name: 'Level', value: `${summoner.summonerLevel ?? 'N/A'}`, inline: true});

    if (Array.isArray(entries) && entries.length > 0) {
        for (const entry of entries) {
            const tier = entry.tier ?? 'Unranked';
            const rank = entry.rank ?? '';
            const lp = entry.leaguePoints ?? 0;
            const wins = entry.wins ?? 0;
            const losses = entry.losses ?? 0;
            const emoji = getTierEmoji(interaction.guild, tier);
            embed.addFields({
                name: entry.queueType ?? 'TFT Ranked',
                value: `**${tier} ${rank}** ${emoji} (${lp} LP)\nWins: ${wins}, Losses: ${losses}`,
                inline: false,
            });
        }
    } else {
        embed.addFields({name: 'Ranked', value: 'No TFT ranked data found.', inline: false});
    }

    await interaction.editReply({embeds: [embed]});
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
