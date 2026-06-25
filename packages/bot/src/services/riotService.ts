import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {RiotApi, LolApi, TftApi} from 'twisted';
import {LeagueConfig} from "@zeffuro/fakegaming-common/models";
import {formatRiotId, parseRiotId} from '@zeffuro/fakegaming-common/utils';
import {
    AccountAPIRegionGroups,
    Regions,
    RegionGroups,
    regionToRegionGroupForAccountAPI,
} from '../modules/league/constants/riotRegions.js';

const puuidCache = new Map<string, string>();

type RiotApiKeyScope = 'account' | 'league' | 'tft';

function getRiotApiKey(scope: RiotApiKeyScope): string {
    const key = {
        account: process.env.RIOT_ACCOUNT_API_KEY || process.env.RIOT_LEAGUE_API_KEY || process.env.RIOT_TFT_API_KEY || process.env.RIOT_DEV_API_KEY,
        league: process.env.RIOT_LEAGUE_API_KEY || process.env.RIOT_DEV_API_KEY,
        tft: process.env.RIOT_TFT_API_KEY || process.env.RIOT_DEV_API_KEY
    }[scope];

    if (!key) {
        throw new Error(`Missing Riot ${scope} API key`);
    }

    return key;
}

// Safe conversion from region to account API region group with fallback mapping
function safeAccountRegionGroup(region: Regions | string): AccountAPIRegionGroups {
    try {
        return regionToRegionGroupForAccountAPI(region as Regions);
    } catch {
        const r = String(region).toLowerCase();
        const fallback: Record<string, AccountAPIRegionGroups> = {
            // Americas routing for these platforms
            'na1': RegionGroups.AMERICAS,
            'br1': RegionGroups.AMERICAS,
            'la1': RegionGroups.AMERICAS,
            'la2': RegionGroups.AMERICAS,
            'oc1': RegionGroups.AMERICAS,
            // Europe routing
            'euw1': RegionGroups.EUROPE,
            'eun1': RegionGroups.EUROPE,
            'tr1': RegionGroups.EUROPE,
            'ru': RegionGroups.EUROPE,
            'me1': RegionGroups.EUROPE,
            // Asia routing
            'jp1': RegionGroups.ASIA,
            'kr': RegionGroups.ASIA,
            // SEA platforms use ASIA for Account API routing
            'sg2': RegionGroups.ASIA,
            'tw2': RegionGroups.ASIA,
            'vn2': RegionGroups.ASIA,
            // PBE maps to AMERICAS
            'pbe1': RegionGroups.AMERICAS
        };
        const group = fallback[r];
        if (!group) {
            throw new Error(`Unsupported region: ${region}`);
        }
        return group;
    }
}

function normalizeRiotError(_err: unknown): string {
    const err = _err as unknown;
    if (typeof err === 'string') return err;

    const responseStatus = (err as { response?: { data?: { status?: { status_code?: number; message?: string } } } })?.response?.data?.status;
    if (responseStatus && (responseStatus.status_code || responseStatus.message)) {
        const code = responseStatus.status_code ? String(responseStatus.status_code) : '';
        return `${code}${code ? ' ' : ''}${responseStatus.message ?? 'Error'}`.trim();
    }

    if (err && typeof err === 'object' && 'status' in err) {
        const status = (err as { status?: { status_code?: number; message?: string } }).status;
        if (status && (status.status_code || status.message)) {
            const code = status.status_code ? String(status.status_code) : '';
            return `${code}${code ? ' ' : ''}${status.message ?? 'Error'}`.trim();
        }
    }

    if (err instanceof Error && err.message) return err.message;
    return 'Unknown error';
}

function isRiotErrorPayload(data: unknown): data is { status: { status_code?: number; message?: string } } {
    return !!(data && typeof data === 'object' && 'status' in (data as Record<string, unknown>));
}

// --- New DRY helpers for unwrapping and calling Riot APIs ---
function unwrapResponse<T>(result: unknown): T {
    const maybe = (result as { response?: unknown })?.response;
    return (maybe ?? result) as T;
}

function errorFromDataIfAny(data: unknown): string | undefined {
    if (isRiotErrorPayload(data)) {
        const status = (data as { status: { status_code?: number; message?: string } }).status;
        const code = status.status_code ? String(status.status_code) : '';
        return `${code}${code ? ' ' : ''}${status.message ?? 'Error'}`.trim();
    }
    return undefined;
}

interface RiotCallOptions {
    validate?: (data: unknown) => string | undefined;
    transformError?: (message: string) => string;
}

async function callRiot<TApi, T>(
    createApi: () => TApi,
    run: (api: TApi) => Promise<unknown>,
    options?: RiotCallOptions
): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
        const raw = await run(createApi());
        const data = unwrapResponse<T>(raw);
        const dataError = errorFromDataIfAny(data) || (options?.validate ? options.validate(data) : undefined);
        if (dataError) return { success: false, error: dataError };
        return { success: true, data };
    } catch (error: unknown) {
        const base = normalizeRiotError(error);
        const msg = options?.transformError ? options.transformError(base) : base;
        return { success: false, error: msg };
    }
}

async function callLol<T>(
    run: (api: LolApi) => Promise<unknown>,
    options?: RiotCallOptions
): Promise<{ success: boolean; data?: T; error?: string }> {
    return await callRiot(() => new LolApi({ key: getRiotApiKey('league') }), run, options);
}

async function callTft<T>(
    run: (api: TftApi) => Promise<unknown>,
    options?: RiotCallOptions
): Promise<{ success: boolean; data?: T; error?: string }> {
    return await callRiot(() => new TftApi({ key: getRiotApiKey('tft') }), run, options);
}

export async function getSummoner(puuid: string, region: Regions): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    const validateSummoner = (data: unknown): string | undefined => {
        if (!data || typeof data !== 'object' || !('puuid' in data && 'summonerLevel' in data)) {
            return 'Malformed summoner data';
        }
        return undefined;
    };
    const transformError = (message: string): string => {
        const lower = message.toLowerCase();
        if (lower.includes('not found')) return 'not found';
        if (lower.trim() === 'fail') return 'fail';
        return message;
    };
    return callLol<object>(
        async (api) => api.Summoner.getByPUUID(puuid, region as Regions),
        { validate: validateSummoner, transformError }
    );
}

export async function getPUUIDByRiotId(
    gameName: string,
    tagLine: string,
    region: AccountAPIRegionGroups,
    options: { bypassCache?: boolean } = {}
): Promise<string> {
    const cacheKey = `${gameName.trim().toLowerCase()}#${tagLine.trim().toLowerCase()}`;
    if (!options.bypassCache && puuidCache.has(cacheKey)) {
        return puuidCache.get(cacheKey)!;
    }
    try {
        const riotApi = new RiotApi({key: getRiotApiKey('account')});
        const {response} = await riotApi.Account.getByRiotId(gameName, tagLine, region);
        puuidCache.set(cacheKey, response.puuid);
        return response.puuid;
    } catch (error: unknown) {
        throw new Error(`Failed to fetch PUUID by Riot ID: ${normalizeRiotError(error)}`);
    }
}

export async function getMatchHistory(puuid: string, region: AccountAPIRegionGroups, start: number = 0, count: number = 20): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    return callLol<object>(async (api) => api.MatchV5.list(puuid, region, { start, count }));
}

export async function getMatchDetails(matchId: string, region: AccountAPIRegionGroups): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    return callLol<object>(async (api) => api.MatchV5.get(matchId, region));
}

/**
 * Fetches ranked stats for a summoner by PUUID and region.
 * Returns success, data, and error fields.
 */
export async function getSummonerDetails(puuid: string, region: Regions): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    return callLol<object>(async (api) => api.League.byPUUID(puuid, region));
}

/**
 * Resolves a League identity (summoner, region, puuid) from options or user config.
 * Throws if missing or cannot resolve.
 */
export async function resolveLeagueIdentity(options: {
    summoner?: string;
    region?: Regions;
    userId?: string;
}): Promise<{ summoner: string; region: Regions; puuid: string }> {
    let summoner = options.summoner;
    let region = options.region;
    const userId = options.userId;

    const userConfig = userId
        ? await getConfigManager().userManager.getUserWithLeague(userId)
        : undefined;
    let puuid: string | undefined;

    if (!summoner && !region && userConfig && userConfig.league) {
        const leagueConfig: LeagueConfig = userConfig.league;
        summoner = formatRiotId(
            leagueConfig.riotIdGameName,
            leagueConfig.riotIdTagLine,
            leagueConfig.summonerName
        );
        region = leagueConfig.region as Regions;
        if (leagueConfig.puuid) {
            puuid = leagueConfig.puuid;
        }

        const riotId = parseRiotId(summoner);
        if (riotId?.tagLine) {
            try {
                const accountRegion = safeAccountRegionGroup(region);
                const refreshedPuuid = await getPUUIDByRiotId(riotId.gameName, riotId.tagLine, accountRegion, { bypassCache: true });
                if (refreshedPuuid && refreshedPuuid !== puuid) {
                    puuid = refreshedPuuid;
                    if (typeof leagueConfig.update === 'function') {
                        await leagueConfig.update({ puuid: refreshedPuuid });
                    }
                }
            } catch {
                // Keep the stored PUUID if Account-V1 is temporarily unavailable.
            }
        }
    }

    if (!summoner || !region) {
        throw new Error('Missing summoner or region');
    }

    if (!puuid) {
        const riotId = parseRiotId(summoner);
        if (riotId?.tagLine) {
            const accountRegion = safeAccountRegionGroup(region);
            puuid = await getPUUIDByRiotId(riotId.gameName, riotId.tagLine, accountRegion);
        } else {
            // We require Riot ID with tagline for unlinked users, since name-only lookup is not supported in our Twisted version
            throw new Error('Riot ID must include a tagline (e.g., Name#EUW) or link your account first');
        }
    }

    if (!puuid) {
        throw new Error('Could not resolve PUUID');
    }

    return {summoner, region, puuid};
}

// TFT: Teamfight Tactics
export async function getTftMatchHistory(puuid: string, region: AccountAPIRegionGroups, start: number = 0, count: number = 20): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    return callTft<object>(async (api) => api.Match.list(puuid, region, { start, count }));
}

export async function getTftMatchDetails(matchId: string, region: AccountAPIRegionGroups): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    return callTft<object>(async (api) => api.Match.get(matchId, region));
}

export async function getTftSummoner(puuid: string, region: Regions): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    return callTft<object>(async (api) => api.Summoner.getByPUUID(puuid, region));
}

export async function getTftLeagueEntries(puuid: string, region: Regions): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    return callTft<object>(async (api) => api.League.getByPUUID(puuid, region));
}
