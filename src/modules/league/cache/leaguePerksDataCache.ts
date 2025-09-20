import {getAsset} from '../../../utils/assetCache.js';
import {LeaguePerk} from "../types/leagueAssetTypes.js";

let cachedPerksData: LeaguePerk[];

export async function getPerksData(): Promise<LeaguePerk[]> {
    if (cachedPerksData) return cachedPerksData;
    const asset = await getAsset(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json',
        'perks.json',
        'perksdata'
    );
    if (!asset.buffer) {
        throw new Error('Asset buffer is null');
    }
    cachedPerksData = JSON.parse(asset.buffer.toString());
    return cachedPerksData;
}

