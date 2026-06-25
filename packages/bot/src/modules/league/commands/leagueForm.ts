import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getMatchDetails, getMatchHistory } from '../../../services/riotService.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { recordBotAuditEvent } from '../../../utils/audit.js';
import { regionToRegionGroupForAccountAPI } from '../constants/riotRegions.js';
import type { Regions } from '../constants/riotRegions.js';
import { leagueForm as META } from '../commands.manifest.js';
import { buildCommonLeagueOptions } from '../shared/commandOptions.js';
import { getLeagueIdentityFromInteraction } from '../utils/leagueUtils.js';
import type { LeagueMatchDto } from '../types/riotDtos.js';
import {
    buildLeagueRecentFormSnapshot,
    getRecentFormMatchCount,
    getRecentFormTtlMs,
    type LeagueRecentFormSnapshot,
} from '../recentForm/leagueRecentForm.js';
import {
    getCachedLeagueRecentForm,
    getLeagueRecentFormCacheKey,
    setCachedLeagueRecentForm,
} from '../recentForm/leagueRecentFormCache.js';

const data = buildCommonLeagueOptions(createSlashCommand(META))
    .addBooleanOption(option =>
        option
            .setName('refresh')
            .setDescription('Bypass the short cache and refresh from Riot')
            .setRequired(false)
    );

interface LeagueIdentity {
    summoner: string;
    region: Regions;
    puuid: string;
}

type LeagueFormAuditOutcome =
    | 'cache_hit'
    | 'live_success'
    | 'live_partial'
    | 'empty_history'
    | 'missing_identity'
    | 'identity_failure'
    | 'unsupported_region'
    | 'history_failure'
    | 'malformed_history'
    | 'detail_failure';

type LeagueFormErrorCategory = 'missing_key' | 'rate_limited' | 'not_found' | 'malformed_data' | 'provider_error' | 'unknown';
type LeagueFormCacheStatus = 'hit' | 'miss' | 'bypass' | 'not_checked';

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const refresh = interaction.options.getBoolean('refresh') ?? false;

    let identity: LeagueIdentity;
    try {
        identity = await getLeagueIdentityFromInteraction(interaction) as LeagueIdentity;
    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        const inputError = isIdentityInputError(errorMessage);
        await recordLeagueFormAudit(interaction, {
            outcome: inputError ? 'missing_identity' : 'identity_failure',
            refreshRequested: refresh,
            cacheStatus: 'not_checked',
            severity: inputError ? 'warn' : 'error',
            success: false,
            errorCategory: inputError ? undefined : categorizeRiotError(errorMessage),
        });
        await interaction.editReply(inputError
            ? 'Please provide a Riot ID and region, or link your account first.'
            : getIdentityFailureReply(errorMessage));
        return;
    }

    const cacheKey = getLeagueRecentFormCacheKey(identity.region, identity.puuid);
    const liveCacheStatus: LeagueFormCacheStatus = refresh ? 'bypass' : 'miss';
    if (!refresh) {
        const cached = getCachedLeagueRecentForm(cacheKey);
        if (cached) {
            await recordLeagueFormAudit(interaction, {
                outcome: 'cache_hit',
                identity,
                snapshot: cached,
                source: 'cache',
                refreshRequested: refresh,
                cacheStatus: 'hit',
            });
            await interaction.editReply({ embeds: [buildLeagueFormEmbed(identity, cached, 'Cached')] });
            return;
        }
    }

    let regionGroup: ReturnType<typeof regionToRegionGroupForAccountAPI>;
    try {
        regionGroup = regionToRegionGroupForAccountAPI(identity.region);
    } catch {
        await recordLeagueFormAudit(interaction, {
            outcome: 'unsupported_region',
            identity,
            refreshRequested: refresh,
            cacheStatus: liveCacheStatus,
            severity: 'warn',
            success: false,
        });
        await interaction.editReply(`Unsupported Riot region: ${identity.region}`);
        return;
    }

    const matchCount = getRecentFormMatchCount();
    const history = await getMatchHistory(identity.puuid, regionGroup, 0, matchCount);
    if (!history.success) {
        await recordLeagueFormAudit(interaction, {
            outcome: 'history_failure',
            identity,
            refreshRequested: refresh,
            cacheStatus: liveCacheStatus,
            severity: 'error',
            success: false,
            errorCategory: categorizeRiotError(history.error),
        });
        await interaction.editReply(`Failed to fetch League recent form: ${history.error ?? 'Unknown error'}`);
        return;
    }

    const matchIds = history.data;
    if (!Array.isArray(matchIds)) {
        await recordLeagueFormAudit(interaction, {
            outcome: 'malformed_history',
            identity,
            refreshRequested: refresh,
            cacheStatus: liveCacheStatus,
            severity: 'error',
            success: false,
            errorCategory: 'malformed_data',
        });
        await interaction.editReply('Failed to fetch League recent form: malformed match history.');
        return;
    }

    const matches: LeagueMatchDto[] = [];
    let failedDetailCount = 0;
    let firstDetailError: string | undefined;

    for (const matchId of matchIds) {
        if (typeof matchId !== 'string' || matchId.trim().length === 0) {
            failedDetailCount += 1;
            continue;
        }

        const details = await getMatchDetails(matchId, regionGroup);
        if (!details.success || !details.data) {
            failedDetailCount += 1;
            firstDetailError ??= details.error;
            continue;
        }
        matches.push(details.data as LeagueMatchDto);
    }

    if (matchIds.length > 0 && matches.length === 0 && failedDetailCount > 0) {
        await recordLeagueFormAudit(interaction, {
            outcome: 'detail_failure',
            identity,
            refreshRequested: refresh,
            cacheStatus: liveCacheStatus,
            severity: 'error',
            success: false,
            requestedMatchCount: matchIds.length,
            failedDetailCount,
            errorCategory: categorizeRiotError(firstDetailError),
        });
        await interaction.editReply(`Failed to fetch details for recent League matches: ${firstDetailError ?? 'Unknown error'}`);
        return;
    }

    const snapshot = buildLeagueRecentFormSnapshot(matches, identity, {
        ttlMs: getRecentFormTtlMs(),
        requestedMatchCount: matchIds.length,
        failedDetailCount,
    });
    setCachedLeagueRecentForm(cacheKey, snapshot);
    await recordLeagueFormAudit(interaction, {
        outcome: snapshot.status === 'empty_history'
            ? 'empty_history'
            : snapshot.status === 'partial'
                ? 'live_partial'
                : 'live_success',
        identity,
        snapshot,
        source: 'live',
        refreshRequested: refresh,
        cacheStatus: liveCacheStatus,
        severity: snapshot.status === 'partial' ? 'warn' : 'info',
        requestedMatchCount: matchIds.length,
        failedDetailCount,
    });

    await interaction.editReply({ embeds: [buildLeagueFormEmbed(identity, snapshot, 'Live')] });
}

async function recordLeagueFormAudit(
    interaction: ChatInputCommandInteraction,
    params: {
        outcome: LeagueFormAuditOutcome;
        identity?: Pick<LeagueIdentity, 'region'>;
        snapshot?: LeagueRecentFormSnapshot;
        source?: 'cache' | 'live';
        refreshRequested: boolean;
        cacheStatus: LeagueFormCacheStatus;
        severity?: 'info' | 'warn' | 'error';
        success?: boolean;
        requestedMatchCount?: number;
        failedDetailCount?: number;
        errorCategory?: LeagueFormErrorCategory;
    }
): Promise<void> {
    await recordBotAuditEvent(interaction, {
        action: 'riot.leagueForm',
        targetType: 'riotRecentForm',
        targetId: params.identity?.region ?? null,
        severity: params.severity ?? 'info',
        status: params.success === false ? 'failure' : 'success',
        metadata: {
            provider: 'riot',
            game: 'league',
            outcome: params.outcome,
            source: params.source,
            refreshRequested: params.refreshRequested,
            cacheStatus: params.cacheStatus,
            region: params.identity?.region,
            summaryStatus: params.snapshot?.status,
            matchCount: params.snapshot?.matchCount,
            wins: params.snapshot?.wins,
            losses: params.snapshot?.losses,
            requestedMatchCount: params.requestedMatchCount,
            failedDetailCount: params.failedDetailCount,
            errorCategory: params.errorCategory,
        },
    });
}

function categorizeRiotError(message: string | undefined): LeagueFormErrorCategory {
    const normalized = message?.toLowerCase() ?? '';
    if (!normalized) return 'unknown';
    if (normalized.includes('missing') && normalized.includes('api key')) return 'missing_key';
    if (normalized.includes('rate limit') || normalized.includes('429')) return 'rate_limited';
    if (normalized.includes('not found') || normalized.includes('404')) return 'not_found';
    if (normalized.includes('malformed')) return 'malformed_data';
    return 'provider_error';
}

function getErrorMessage(error: unknown): string | undefined {
    return error instanceof Error ? error.message : undefined;
}

function isIdentityInputError(message: string | undefined): boolean {
    const normalized = message?.toLowerCase() ?? '';
    return normalized.includes('missing summoner or region')
        || normalized.includes('riot id must include a tagline')
        || normalized.includes('could not resolve puuid');
}

function getIdentityFailureReply(message: string | undefined): string {
    const category = categorizeRiotError(message);
    if (category === 'missing_key') {
        return 'Riot account lookup is unavailable because the bot is missing a Riot API key.';
    }
    if (category === 'not_found') {
        return 'Failed to resolve Riot account. Please check the Riot ID and region.';
    }
    return 'Riot account lookup is unavailable. Please try again later.';
}

function buildLeagueFormEmbed(
    identity: Pick<LeagueIdentity, 'summoner' | 'region'>,
    snapshot: LeagueRecentFormSnapshot,
    source: 'Cached' | 'Live'
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`League form for ${identity.summoner} [${identity.region}]`)
        .setColor(snapshot.status === 'partial' ? 0xf0b429 : 0x4f8cff)
        .setFooter({ text: `${source} summary - refreshed ${formatDate(snapshot.refreshedAt)} - expires ${formatDate(snapshot.expiresAt)}` });

    if (snapshot.status === 'empty_history') {
        return embed.setDescription('No recent League matches found.');
    }

    const statusSuffix = snapshot.status === 'partial' ? ' Partial summary; some matches could not be included.' : '';
    embed
        .setDescription(`${snapshot.wins}W-${snapshot.losses}L over ${snapshot.matchCount} recent games.${statusSuffix}`)
        .addFields(
            {
                name: 'Recent results',
                value: snapshot.recentResults.length > 0 ? snapshot.recentResults.join(' ') : 'None',
                inline: true,
            },
            {
                name: 'Average KDA',
                value: `${snapshot.averageKills}/${snapshot.averageDeaths}/${snapshot.averageAssists}`,
                inline: true,
            },
            {
                name: 'Averages',
                value: `${snapshot.averageCsPerMinute} CS/min\n${snapshot.averageVisionScore} vision`,
                inline: true,
            }
        );

    if (snapshot.topChampions.length > 0) {
        embed.addFields({
            name: 'Top champions',
            value: snapshot.topChampions
                .map((champion) => `${champion.name}: ${champion.games} game${champion.games === 1 ? '' : 's'}, ${champion.wins}W`)
                .join('\n'),
            inline: false,
        });
    }

    if (snapshot.lastMatchAt) {
        embed.addFields({
            name: 'Last match',
            value: formatDate(snapshot.lastMatchAt),
            inline: true,
        });
    }

    return embed;
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
