import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {RiotApi, LolApi, TftApi} from 'twisted';
import {AccountAPIRegionGroups, Regions, regionToRegionGroupForAccountAPI} from 'twisted/dist/constants/regions.js';
import {LeagueConfig} from "@zeffuro/fakegaming-common/models";

const puuidCache = new Map<string, string>();

export async function getSummoner(puuid: string, region: Regions): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    try {
        const lolApi = new LolApi({key: process.env.RIOT_LEAGUE_API_KEY});
        const result = await lolApi.Summoner.getByPUUID(puuid, region as Regions);
        const data = result?.response ?? result;
        // Require all expected properties for a valid summoner
        if (!data || typeof data !== 'object' || !('puuid' in data && 'name' in data && 'summonerLevel' in data)) {
            return {success: false, error: 'Malformed summoner data'};
        }
        return {success: true, data};
    } catch (error: unknown) {
        let errorMessage = 'Failed to fetch summoner';
        if (typeof error === 'string') {
            errorMessage = error;
        } else if (error instanceof Error && error.message) {
            errorMessage = error.message;
        }
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
        const riotApi = new RiotApi({key: process.env.RIOT_LEAGUE_API_KEY});
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
        const lolApi = new LolApi({key: process.env.RIOT_LEAGUE_API_KEY});
        const {response} = await lolApi.MatchV5.list(puuid, region, {start, count});
        return {success: true, data: response};
    } catch (error: unknown) {
        const errorMessage = (error instanceof Error && error.message) ? error.message : 'Failed to fetch match history';
        return {success: false, error: errorMessage};
    }
}

export async function getMatchDetails(matchId: string, region: AccountAPIRegionGroups): Promise<{
    success: boolean,
    data?: object,
    error?: string
}> {
    try {
        const lolApi = new LolApi({key: process.env.RIOT_LEAGUE_API_KEY});
        const {response} = await lolApi.MatchV5.get(matchId, region);
        return {success: true, data: response};
    } catch (error: unknown) {
        const errorMessage = (error instanceof Error && error.message) ? error.message : 'Failed to fetch match details';
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
        const lolApi = new LolApi({key: process.env.RIOT_LEAGUE_API_KEY});
        const {response} = await lolApi.League.byPUUID(puuid, region);
        return {success: true, data: response};
    } catch (error: unknown) {
        const errorMessage = (error instanceof Error && error.message) ? error.message : 'Failed to fetch summoner details';
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
            const accountRegion = regionToRegionGroupForAccountAPI(region);
            puuid = await getPUUIDByRiotId(gameName, tagLine, accountRegion);
        } else {
            const summonerData = await getSummoner(gameName, region);
            if (!summonerData.success) {
                throw new Error(summonerData.error || 'Failed to fetch summoner');
            }
            puuid = (summonerData.data && (summonerData.data as { puuid?: string }).puuid) || undefined;
            if (!puuid) {
                throw new Error('Failed to fetch summoner PUUID');
            }
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
