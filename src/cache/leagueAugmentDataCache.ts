import {getAsset} from '../utils/assetCache.js';

let cachedAugmentsData: any = null;

export async function getAugmentData(): Promise<any> {
    if (cachedAugmentsData) return cachedAugmentsData;
    const asset = await getAsset(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json',
        'cherry-augments.json',
        'augmentdata'
    );
    cachedAugmentsData = JSON.parse(asset.buffer.toString());
    return cachedAugmentsData;
}

