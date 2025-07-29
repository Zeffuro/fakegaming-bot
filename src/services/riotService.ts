import {configManager} from '../config/configManagerSingleton.js';
import {RiotApi, LolApi} from 'twisted';
import {AccountAPIRegionGroups, Regions, regionToRegionGroupForAccountAPI} from 'twisted/dist/constants/regions.js';

const lolApi = new LolApi({key: process.env.RIOT_API_KEY});
const riotApi = new RiotApi({key: process.env.RIOT_API_KEY});

const puuidCache = new Map<string, string>();

export async function getSummoner(puuid: string, region: Regions): Promise<any> {
    try {
        const {response} = await lolApi.Summoner.getByPUUID(puuid, region as any);
        return response;
    } catch (error) {
        throw new Error('Failed to fetch summoner');
    }
}

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

export async function getMatchHistory(puuid: string, region: AccountAPIRegionGroups, start: number = 0, count: number = 20): Promise<any> {
    try {
        const {response} = await lolApi.MatchV5.list(puuid, region, {start, count});
        return response;
    } catch (error) {
        throw new Error('Failed to fetch match history');
    }
}

export async function getMatchDetails(matchId: string, region: AccountAPIRegionGroups): Promise<any> {
    try {
        const {response} = await lolApi.MatchV5.get(matchId, region);
        return response;
    } catch (error) {
        throw new Error('Failed to fetch match details');
    }
}

export async function getSummonerDetails(puuid: string, region: Regions): Promise<any> {
    try {
        const {response} = await lolApi.League.byPUUID(puuid, region);
        return response;
    } catch (error) {
        throw new Error('Failed to fetch summoner details');
    }
}

export async function resolveLeagueIdentity(options: {
    summoner?: string;
    region?: Regions;
    userId?: string;
}): Promise<{ summoner: string; region: Regions; puuid: string }> {
    let {summoner, region, userId} = options;

    const userConfig = userId ? configManager.userManager.getUser(userId) : undefined;
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
            puuid = summonerData.puuid;
        }
    }

    if (!puuid) {
        throw new Error('Could not resolve PUUID');
    }

    return {summoner, region, puuid};
}