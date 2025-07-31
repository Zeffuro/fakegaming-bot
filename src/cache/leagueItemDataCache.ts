// src/utils/itemDataCache.ts
import {getAsset} from '../utils/assetCache.js';

let cachedItemsData: any = null;

export async function getItemData(): Promise<any> {
    if (cachedItemsData) return cachedItemsData;
    const asset = await getAsset(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json',
        'items.json',
        'itemdata'
    );
    cachedItemsData = JSON.parse(asset.buffer.toString());
    return cachedItemsData;
}