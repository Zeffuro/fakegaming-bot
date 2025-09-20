import {getAsset} from '../../../utils/assetCache.js';
import {LeagueAugment} from '../types/leagueAssetTypes.js';

let cachedAugmentsData: LeagueAugment[];

export async function getAugmentData(): Promise<LeagueAugment[]> {
    if (cachedAugmentsData) return cachedAugmentsData;
    const asset = await getAsset(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json',
        'cherry-augments.json',
        'augmentdata'
    );
    if (!asset.buffer) {
        throw new Error('Asset buffer is null');
    }
    cachedAugmentsData = JSON.parse(asset.buffer.toString());
    return cachedAugmentsData;
}

