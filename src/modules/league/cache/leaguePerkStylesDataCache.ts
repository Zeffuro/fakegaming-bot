import {getAsset} from '../../../utils/assetCache.js';
import {LeaguePerkStylesData} from "../types/leagueAssetTypes.js";

let cachedPerkStylesData: LeaguePerkStylesData;

export async function getPerkStylesData(): Promise<LeaguePerkStylesData> {
    if (cachedPerkStylesData) return cachedPerkStylesData;
    const asset = await getAsset(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json',
        'perkstyles.json',
        'perkstylesdata'
    );
    if (!asset.buffer) {
        throw new Error('Asset buffer is null');
    }
    cachedPerkStylesData = JSON.parse(asset.buffer.toString());
    return cachedPerkStylesData;
}

