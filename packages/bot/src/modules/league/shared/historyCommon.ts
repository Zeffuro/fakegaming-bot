import { AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { regionToRegionGroupForAccountAPI } from 'twisted/dist/constants/regions.js';
import type { Regions } from 'twisted/dist/constants/regions.js';
import { getLeagueIdentityFromInteraction } from '../utils/leagueUtils.js';

export interface LeagueIdentity {
    summoner: string;
    region: Regions;
    puuid: string;
}

export interface HistoryCommandOptions<TMatch> {
    fetchHistory: (puuid: string, regionGroup: ReturnType<typeof regionToRegionGroupForAccountAPI>, start: number, count: number) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    fetchDetails: (matchId: string, regionGroup: ReturnType<typeof regionToRegionGroupForAccountAPI>) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    generateImage: (matches: TMatch[], identity: { puuid: string }) => Promise<Buffer>;
    contentPrefix: string; // e.g., 'Recent League matches' or 'Recent TFT matches'
    historyErrorPrefix: string; // e.g., 'Failed to fetch match history' or 'Failed to fetch TFT match history'
    detailsErrorPrefix: string; // e.g., 'Failed to fetch details for match'
    count?: number; // default 5
}

/**
 * Runs a generic match-history command flow for League/TFT.
 * Handles defer, identity resolution, history + details fetch, image generation, and reply.
 */
export async function runHistoryCommand<TMatch>(interaction: ChatInputCommandInteraction, opts: HistoryCommandOptions<TMatch>): Promise<void> {
    const count = opts.count ?? 5;
    await interaction.deferReply();

    let identity: LeagueIdentity;
    try {
        identity = await getLeagueIdentityFromInteraction(interaction) as LeagueIdentity;
    } catch {
        await interaction.editReply('Please provide a summoner name and region, or link your account first.');
        return;
    }

    const regionGroup = regionToRegionGroupForAccountAPI(identity.region);
    const history = await opts.fetchHistory(identity.puuid, regionGroup, 0, count);
    if (!history.success) {
        await interaction.editReply(`${opts.historyErrorPrefix}: ${history.error ?? 'Unknown error'}`);
        return;
    }
    const matchIds = history.data as string[] | undefined;
    if (!Array.isArray(matchIds) || matchIds.length === 0) {
        await interaction.editReply('No match history found.');
        return;
    }

    const matches: TMatch[] = [];
    for (const matchId of matchIds) {
        const details = await opts.fetchDetails(matchId, regionGroup);
        if (!details.success) {
            await interaction.editReply(`${opts.detailsErrorPrefix} ${matchId}: ${details.error ?? 'Unknown error'}`);
            return;
        }
        const data = details.data as TMatch | undefined;
        if (data) {
            matches.push(data);
        }
    }

    const buffer = await opts.generateImage(matches, { puuid: identity.puuid });
    const fileBase = opts.contentPrefix.toLowerCase().includes('tft') ? 'tft' : 'league';
    const attachment = new AttachmentBuilder(buffer, { name: `${fileBase}-history.png` });

    await interaction.editReply({
        content: `${opts.contentPrefix} for ${identity.summoner} [${identity.region}]`,
        files: [attachment]
    });
}
