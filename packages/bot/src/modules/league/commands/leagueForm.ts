import { runtimeText } from '../../../core/runtimeCopy.js';
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
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { leagueText, missingIdentity, unknownError } from '../copy/leagueCopy.js';

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
    const locale = await resolveInteractionOutputLocale(interaction);
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
            ? missingIdentity(locale)
            : getIdentityFailureReply(errorMessage, locale));
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
            await interaction.editReply({ embeds: [buildLeagueFormEmbed(identity, cached, 'Cached', locale)] });
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
        await interaction.editReply(`${leagueText(locale, "unsupportedRiotRegion")}: ${identity.region}`);
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
        await interaction.editReply(`${leagueText(locale, "failedToFetchLeagueRecentForm")}: ${history.error ?? unknownError(locale)}`);
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
        await interaction.editReply(leagueText(locale, "failedToFetchLeagueRecentFormMalformedMatch"));
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
        await interaction.editReply(`${leagueText(locale, "failedToFetchDetailsForRecentLeagueMatches")}: ${firstDetailError ?? unknownError(locale)}`);
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

    await interaction.editReply({ embeds: [buildLeagueFormEmbed(identity, snapshot, 'Live', locale)] });
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

function getIdentityFailureReply(message: string | undefined, locale: SupportedOutputLocale): string {
    const category = categorizeRiotError(message);
    if (category === 'missing_key') {
        return leagueText(locale, "riotAccountLookupIsUnavailableBecauseTheBot");
    }
    if (category === 'not_found') {
        return leagueText(locale, "failedToResolveRiotAccountPleaseCheckThe");
    }
    return leagueText(locale, "riotAccountLookupIsUnavailablePleaseTryAgain");
}

function buildLeagueFormEmbed(
    identity: Pick<LeagueIdentity, 'summoner' | 'region'>,
    snapshot: LeagueRecentFormSnapshot,
    source: 'Cached' | 'Live',
    locale: SupportedOutputLocale,
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`${leagueText(locale, "leagueFormFor")} ${identity.summoner} [${identity.region}]`)
        .setColor(snapshot.status === 'partial' ? 0xf0b429 : 0x4f8cff)
        .setFooter({ text: `${source === 'Cached' ? leagueText(locale, "cached") : leagueText(locale, "live")} ${leagueText(locale, "summary")} - ${leagueText(locale, "refreshed")} ${formatDate(snapshot.refreshedAt)} - ${leagueText(locale, "expires")} ${formatDate(snapshot.expiresAt)}` });

    if (snapshot.status === 'empty_history') {
        return embed.setDescription(leagueText(locale, "noRecentLeagueMatchesFound"));
    }

    const statusSuffix = snapshot.status === 'partial'
        ? leagueText(locale, "partialSummarySomeMatchesCouldNotBeIncluded")
        : '';
    embed
        .setDescription(runtimeText(locale, 'league', 'recentRecord', {
            wins: snapshot.wins, losses: snapshot.losses, matchCount: snapshot.matchCount, statusSuffix,
        }))
        .addFields(
            {
                name: leagueText(locale, "recentResults"),
                value: snapshot.recentResults.length > 0
                    ? snapshot.recentResults.map(result => result === 'L'
                        ? runtimeText(locale, 'league', 'lossMarker')
                        : result).join(' ')
                    : leagueText(locale, "none"),
                inline: true,
            },
            {
                name: leagueText(locale, "averageKda"),
                value: `${snapshot.averageKills}/${snapshot.averageDeaths}/${snapshot.averageAssists}`,
                inline: true,
            },
            {
                name: leagueText(locale, "averages"),
                value: `${snapshot.averageCsPerMinute} CS/min\n${snapshot.averageVisionScore} ${leagueText(locale, "vision")}`,
                inline: true,
            }
        );

    if (snapshot.topChampions.length > 0) {
        embed.addFields({
            name: leagueText(locale, "topChampions"),
            value: snapshot.topChampions
                .map((champion) => `${champion.name}: ${champion.games} ${champion.games === 1 ? leagueText(locale, "game") : leagueText(locale, "games")}, ${champion.wins}W`)
                .join('\n'),
            inline: false,
        });
    }

    if (snapshot.lastMatchAt) {
        embed.addFields({
            name: leagueText(locale, "lastMatch"),
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
