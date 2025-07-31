import {getAsset} from '../utils/assetCache.js';

let cachedSummonerSpellsData: any = null;

export async function getSummonerSpellData(): Promise<any> {
    if (cachedSummonerSpellsData) return cachedSummonerSpellsData;
    const asset = await getAsset(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json',
        'summoner-spells.json',
        'summonerspelldata'
    );
    cachedSummonerSpellsData = JSON.parse(asset.buffer.toString());
    return cachedSummonerSpellsData;
}

