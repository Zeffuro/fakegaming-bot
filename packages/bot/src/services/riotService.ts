import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {RiotApi, LolApi, TftApi} from 'twisted';
import {AccountAPIRegionGroups, Regions, regionToRegionGroupForAccountAPI, RegionGroups} from 'twisted/dist/constants/regions.js';
import {LeagueConfig} from "@zeffuro/fakegaming-common/models";

const puuidCache = new Map<string, string>();

function getLeagueApiKey(): string {
    // Prefer dedicated LEAGUE key; fall back to DEV key if missing for local/dev convenience
    return process.env.RIOT_LEAGUE_API_KEY || process.env.RIOT_DEV_API_KEY || '';
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
    if (err instanceof Error && err.message) return err.message;
    // Try to extract Riot error payload
    if (err && typeof err === 'object' && 'status' in err) {
        const status = (err as { status?: { status_code?: number; message?: string } }).status;
        if (status && (status.status_code || status.message)) {
            const code = status.status_code ? String(status.status_code) : '';
            return `${code}${code ? ' ' : ''}${status.message ?? 'Error'}`.trim();
        }
    }
    return 'Unknown error';
}

function isRiotErrorPayload(data: unknown): data is { status: { status_code?: number; message?: string } } {
    return !!(data && typeof data === 'object' && 'status' in (data as Record<string, unknown>));
}

export async function getSummoner(puuid: string, region: Regions): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    try {
        const lolApi = new LolApi({key: getLeagueApiKey()});
        const result = await lolApi.Summoner.getByPUUID(puuid, region as Regions);
        const data = (result as unknown as { response?: unknown })?.response ?? result;
        if (isRiotErrorPayload(data)) {
            const status = data.status;
            const code = status.status_code ? String(status.status_code) : '';
            return {success: false, error: `${code}${code ? ' ' : ''}${status.message ?? 'Error'}`.trim()};
        }
        // Require minimal expected properties for a valid summoner
        if (!data || typeof data !== 'object' || !('puuid' in data && 'summonerLevel' in data)) {
            return {success: false, error: 'Malformed summoner data'};
        }
        return {success: true, data};
    } catch (error: unknown) {
        let errorMessage = normalizeRiotError(error);
        // Check for 'not found' (substring, case-insensitive) before 'fail'
        if (errorMessage && errorMessage.toLowerCase().includes('not found')) {
            return {success: false, error: 'not found'};
        }
        if (errorMessage && errorMessage.trim().toLowerCase() === 'fail') {
            return {success: false, error: 'fail'};
        }
        return {success: false, error: errorMessage};
    }
}

export async function getPUUIDByRiotId(gameName: string, tagLine: string, region: AccountAPIRegionGroups): Promise<string> {
    const cacheKey = `${gameName.trim().toLowerCase()}#${tagLine.trim().toLowerCase()}`;
    if (puuidCache.has(cacheKey)) {
        return puuidCache.get(cacheKey)!;
    }
    try {
        const riotApi = new RiotApi({key: getLeagueApiKey()});
        const {response} = await riotApi.Account.getByRiotId(gameName, tagLine, region);
        puuidCache.set(cacheKey, response.puuid);
        return response.puuid;
    } catch {
        throw new Error('Failed to fetch PUUID by Riot ID');
    }
}

export async function getMatchHistory(puuid: string, region: AccountAPIRegionGroups, start: number = 0, count: number = 20): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    try {
        const lolApi = new LolApi({key: getLeagueApiKey()});
        const {response} = await lolApi.MatchV5.list(puuid, region, {start, count});
        return {success: true, data: response};
    } catch (error: unknown) {
        const errorMessage = normalizeRiotError(error);
        return {success: false, error: errorMessage};
    }
}

export async function getMatchDetails(matchId: string, region: AccountAPIRegionGroups): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    try {
        const lolApi = new LolApi({key: getLeagueApiKey()});
        const {response} = await lolApi.MatchV5.get(matchId, region);
        return {success: true, data: response};
    } catch (error: unknown) {
        const errorMessage = normalizeRiotError(error);
        return {success: false, error: errorMessage};
    }
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
    try {
        const lolApi = new LolApi({key: getLeagueApiKey()});
        const {response} = await lolApi.League.byPUUID(puuid, region);
        return {success: true, data: response};
    } catch (error: unknown) {
        const errorMessage = normalizeRiotError(error);
        return {success: false, error: errorMessage};
    }
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
        summoner = leagueConfig.summonerName;
        region = leagueConfig.region as Regions;
        if (leagueConfig.puuid) puuid = leagueConfig.puuid;
    }

    if (!summoner || !region) {
        throw new Error('Missing summoner or region');
    }

    if (!puuid) {
        let gameName = summoner;
        let tagLine = '';
        if (summoner.includes('#')) {
            [gameName, tagLine] = summoner.split('#');
        }
        if (tagLine) {
            const accountRegion = safeAccountRegionGroup(region);
            puuid = await getPUUIDByRiotId(gameName, tagLine, accountRegion);
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
    try {
        const tftApi = new TftApi({key: process.env.RIOT_DEV_API_KEY});
        const {response} = await tftApi.Match.list(puuid, region, {start, count});
        return {success: true, data: response};
    } catch (error: unknown) {
        const errorMessage = (error instanceof Error && error.message) ? error.message : 'Failed to fetch TFT match history';
        return {success: false, error: errorMessage};
    }
}

export async function getTftMatchDetails(matchId: string, region: AccountAPIRegionGroups): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    try {
        const tftApi = new TftApi({key: process.env.RIOT_DEV_API_KEY});
        const {response} = await tftApi.Match.get(matchId, region);
        return {success: true, data: response};
    } catch (error: unknown) {
        const errorMessage = (error instanceof Error && error.message) ? error.message : 'Failed to fetch TFT match details';
        return {success: false, error: errorMessage};
    }
}
