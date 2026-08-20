import { DEFAULT_OUTPUT_LOCALE, resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { regionToRegionGroupForAccountAPI } from '../constants/riotRegions.js';
import type { AccountAPIRegionGroups, Regions } from '../constants/riotRegions.js';
import { getLeagueIdentityFromInteraction } from '../utils/leagueUtils.js';
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { leagueText, missingIdentity, unknownError } from '../copy/leagueCopy.js';

export interface LeagueIdentity {
    summoner: string;
    region: Regions;
    puuid: string;
}

export interface HistoryCommandOptions<TMatch> {
    fetchHistory: (puuid: string, regionGroup: AccountAPIRegionGroups, start: number, count: number) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    fetchDetails: (matchId: string, regionGroup: AccountAPIRegionGroups) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    generateImage: (matches: TMatch[], identity: { puuid: string }, locale?: SupportedOutputLocale) => Promise<Buffer>;
    contentPrefix: OutputLocaleValues<string>;
    historyErrorPrefix: OutputLocaleValues<string>;
    detailsErrorPrefix: OutputLocaleValues<string>;
    count?: number; // default 5
}

/**
 * Runs a generic match-history command flow for League/TFT.
 * Handles defer, identity resolution, history + details fetch, image generation, and reply.
 */
export async function runHistoryCommand<TMatch>(interaction: ChatInputCommandInteraction, opts: HistoryCommandOptions<TMatch>): Promise<void> {
    const count = opts.count ?? 5;
    const locale = await resolveInteractionOutputLocale(interaction);
    await interaction.deferReply();

    let identity: LeagueIdentity;
    try {
        identity = await getLeagueIdentityFromInteraction(interaction) as LeagueIdentity;
    } catch {
        await interaction.editReply(missingIdentity(locale));
        return;
    }

    const regionGroup = regionToRegionGroupForAccountAPI(identity.region);
    const history = await opts.fetchHistory(identity.puuid, regionGroup, 0, count);
    if (!history.success) {
        await interaction.editReply(`${opts.historyErrorPrefix[locale]}: ${history.error ?? unknownError(locale)}`);
        return;
    }
    const matchIds = history.data as string[] | undefined;
    if (!Array.isArray(matchIds) || matchIds.length === 0) {
        await interaction.editReply(leagueText(locale, { en: 'No match history found.', nl: 'Geen wedstrijdgeschiedenis gevonden.' }));
        return;
    }

    const matches: TMatch[] = [];
    for (const matchId of matchIds) {
        const details = await opts.fetchDetails(matchId, regionGroup);
        if (!details.success) {
            await interaction.editReply(`${opts.detailsErrorPrefix[locale]} ${matchId}: ${details.error ?? unknownError(locale)}`);
            return;
        }
        const data = details.data as TMatch | undefined;
        if (data) {
            matches.push(data);
        }
    }

    const buffer = await opts.generateImage(matches, { puuid: identity.puuid }, locale);
    const fileBase = resolveLocaleValue(DEFAULT_OUTPUT_LOCALE, opts.contentPrefix).toLowerCase().includes('tft') ? 'tft' : 'league';
    const attachment = new AttachmentBuilder(buffer, { name: `${fileBase}-history.png` });

    await interaction.editReply({
        content: resolveLocaleValue(locale, {
            en: `${resolveLocaleValue(DEFAULT_OUTPUT_LOCALE, opts.contentPrefix)} for ${identity.summoner} [${identity.region}]`,
            nl: `${resolveLocaleValue('nl', opts.contentPrefix)} voor ${identity.summoner} [${identity.region}]`,
        }),
        files: [attachment]
    });
}
