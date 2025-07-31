import {getAsset} from '../utils/assetCache.js';

let cachedPerkStylesData: any = null;

export async function getPerkStylesData(): Promise<any> {
    if (cachedPerkStylesData) return cachedPerkStylesData;
    const asset = await getAsset(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json',
        'perkstyles.json',
        'perkstylesdata'
    );
    cachedPerkStylesData = JSON.parse(asset.buffer.toString());
    return cachedPerkStylesData;
}

