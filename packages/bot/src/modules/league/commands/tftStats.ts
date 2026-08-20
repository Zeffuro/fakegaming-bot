import {ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import {getTftLeagueEntries, getTftSummoner} from '../../../services/riotService.js';
import {getLeagueIdentityFromInteraction} from '../utils/leagueUtils.js';
import {getTierEmoji} from '../constants/leagueTierEmojis.js';
import {buildCommonLeagueOptions} from '../shared/commandOptions.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {tftStats as META} from '../commands.manifest.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {leagueText, missingIdentity, unknownError} from '../copy/leagueCopy.js';

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
    const locale = await resolveInteractionOutputLocale(interaction);
    await interaction.deferReply();

    let identity;
    try {
        identity = await getLeagueIdentityFromInteraction(interaction);
    } catch {
        await interaction.editReply(missingIdentity(locale));
        return;
    }

    const summonerResult = await getTftSummoner(identity.puuid, identity.region);
    if (!summonerResult.success || !summonerResult.data) {
        await interaction.editReply(`${leagueText(locale, { en: 'Failed to fetch TFT summoner', nl: 'Ophalen van TFT-summoner mislukt' })}: ${summonerResult.error ?? unknownError(locale)}`);
        return;
    }

    const leagueResult = await getTftLeagueEntries(identity.puuid, identity.region);
    if (!leagueResult.success || !leagueResult.data) {
        await interaction.editReply(`${leagueText(locale, { en: 'Failed to fetch TFT ranked stats', nl: 'Ophalen van TFT-rangstatistieken mislukt' })}: ${leagueResult.error ?? unknownError(locale)}`);
        return;
    }

    const summoner = summonerResult.data as { profileIconId?: number; summonerLevel?: number };
    const entries = leagueResult.data as TftLeagueEntry[];
    const embed = new EmbedBuilder()
        .setTitle(`${leagueText(locale, { en: 'TFT Stats for', nl: 'TFT-statistieken voor' })} ${identity.summoner} [${identity.region}]`)
        .setThumbnail(`https://raw.communitydragon.org/latest/game/assets/ux/summonericons/profileicon${summoner.profileIconId ?? 0}.png`)
        .addFields({name: leagueText(locale, { en: 'Level', nl: 'Niveau' }), value: `${summoner.summonerLevel ?? leagueText(locale, { en: 'N/A', nl: 'N.v.t.' })}`, inline: true});

    if (Array.isArray(entries) && entries.length > 0) {
        for (const entry of entries) {
            const tier = entry.tier ?? leagueText(locale, { en: 'Unranked', nl: 'Ongerangschikt' });
            const rank = entry.rank ?? '';
            const lp = entry.leaguePoints ?? 0;
            const wins = entry.wins ?? 0;
            const losses = entry.losses ?? 0;
            const emoji = getTierEmoji(interaction.guild, tier);
            embed.addFields({
                name: entry.queueType ?? leagueText(locale, { en: 'TFT Ranked', nl: 'TFT-ranglijst' }),
                value: `**${tier} ${rank}** ${emoji} (${lp} LP)\n${leagueText(locale, { en: 'Wins', nl: 'Overwinningen' })}: ${wins}, ${leagueText(locale, { en: 'Losses', nl: 'Nederlagen' })}: ${losses}`,
                inline: false,
            });
        }
    } else {
        embed.addFields({name: leagueText(locale, { en: 'Ranked', nl: 'Ranglijst' }), value: leagueText(locale, { en: 'No TFT ranked data found.', nl: 'Geen TFT-ranggegevens gevonden.' }), inline: false});
    }

    await interaction.editReply({embeds: [embed]});
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
