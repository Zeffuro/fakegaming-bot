import {getAsset} from '../../../utils/assetCache.js';
import {LeagueItem} from "../types/leagueAssetTypes.js";

let cachedItemsData: LeagueItem[];

export async function getItemData(): Promise<LeagueItem[]> {
    if (cachedItemsData) return cachedItemsData;
    const asset = await getAsset(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json',
        'items.json',
        'itemdata'
    );
    if (!asset.buffer) {
        throw new Error('Asset buffer is null');
    }
    cachedItemsData = JSON.parse(asset.buffer.toString());
    return cachedItemsData;
}