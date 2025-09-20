import {configManager} from '../config/configManagerSingleton.js';
import {RiotApi, LolApi, TftApi} from 'twisted';
import {AccountAPIRegionGroups, Regions, regionToRegionGroupForAccountAPI} from 'twisted/dist/constants/regions.js';

const lolApi = new LolApi({key: process.env.RIOT_LEAGUE_API_KEY});
const tftApi = new TftApi({key: process.env.RIOT_DEV_API_KEY});
const riotApi = new RiotApi({key: process.env.RIOT_LEAGUE_API_KEY});

const puuidCache = new Map<string, string>();

/**
 * Fetches a summoner's data by PUUID and region.
 * Returns success, data, and error fields.
 */
export async function getSummoner(puuid: string, region: Regions): Promise<{
    success: boolean,
    data?: any,
    error?: string
}> {
    try {
        const {response} = await lolApi.Summoner.getByPUUID(puuid, region as any);
        return {success: true, data: response};
    } catch (error: any) {
        return {success: false, error: error?.message || 'Failed to fetch summoner'};
    }
}

/**
 * Fetches a PUUID by Riot ID (gameName and tagLine) and region group.
 * Uses cache for performance.
 */
export async function getPUUIDByRiotId(gameName: string, tagLine: string, region: AccountAPIRegionGroups): Promise<string> {
    const cacheKey = `${gameName.trim().toLowerCase()}#${tagLine.trim().toLowerCase()}`;
    if (puuidCache.has(cacheKey)) {
        return puuidCache.get(cacheKey)!;
    }
    try {
        const {response} = await riotApi.Account.getByRiotId(gameName, tagLine, region);
        puuidCache.set(cacheKey, response.puuid);
        return response.puuid;
    } catch (error) {
        throw new Error('Failed to fetch PUUID by Riot ID');
    }
}

/**
 * Fetches match history for a summoner by PUUID and region group.
 * Returns success, data, and error fields.
 */
export async function getMatchHistory(puuid: string, region: AccountAPIRegionGroups, start: number = 0, count: number = 20): Promise<{
    success: boolean,
    data?: any,
    error?: string
}> {
    try {
        const {response} = await lolApi.MatchV5.list(puuid, region, {start, count});
        return {success: true, data: response};
    } catch (error: any) {
        return {success: false, error: error?.message || 'Failed to fetch match history'};
    }
}

/**
 * Fetches match details by match ID and region group.
 * Returns success, data, and error fields.
 */
export async function getMatchDetails(matchId: string, region: AccountAPIRegionGroups): Promise<{
    success: boolean,
    data?: any,
    error?: string
}> {
    try {
        const {response} = await lolApi.MatchV5.get(matchId, region);
        return {success: true, data: response};
    } catch (error: any) {
        return {success: false, error: error?.message || 'Failed to fetch match details'};
    }
}

/**
 * Fetches ranked stats for a summoner by PUUID and region.
 * Returns success, data, and error fields.
 */
export async function getSummonerDetails(puuid: string, region: Regions): Promise<{
    success: boolean,
    data?: any,
    error?: string
}> {
    try {
        const {response} = await lolApi.League.byPUUID(puuid, region);
        return {success: true, data: response};
    } catch (error: any) {
        return {success: false, error: error?.message || 'Failed to fetch summoner details'};
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
    let {summoner, region, userId} = options;

    const userConfig = userId ? configManager.userManager.getUser({discordId: userId}) : undefined;
    let puuid: string | undefined;

    if (!summoner && !region && userConfig) {
        summoner = userConfig.league?.summonerName;
        region = userConfig.league?.region as Regions;
        if (userConfig.league?.puuid) puuid = userConfig.league.puuid;
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
            puuid = summonerData.data.puuid;
        }
    }

    if (!puuid) {
        throw new Error('Could not resolve PUUID');
    }

    return {summoner, region, puuid};
}

// TFT: Teamfight Tactics
/**
 * Fetches TFT match history for a summoner by PUUID and region group.
 * Returns success, data, and error fields.
 */
export async function getTftMatchHistory(puuid: string, region: AccountAPIRegionGroups, start: number = 0, count: number = 20): Promise<{
    success: boolean,
    data?: any,
    error?: string
}> {
    try {
        const {response} = await tftApi.Match.list(puuid, region, {start, count});
        return {success: true, data: response};
    } catch (error: any) {
        return {success: false, error: error?.message || 'Failed to fetch TFT match history'};
    }
}

/**
 * Fetches TFT match details by match ID and region group.
 * Returns success, data, and error fields.
 */
export async function getTftMatchDetails(matchId: string, region: AccountAPIRegionGroups): Promise<{
    success: boolean,
    data?: any,
    error?: string
}> {
    try {
        const {response} = await tftApi.Match.get(matchId, region);
        return {success: true, data: response};
    } catch (error: any) {
        return {success: false, error: error?.message || 'Failed to fetch TFT match details'};
    }
}
