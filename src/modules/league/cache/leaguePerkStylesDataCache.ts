import {LeaguePerkStylesData} from '../types/leagueAssetTypes.js';
import {getTypedAsset} from '../../../utils/typedAssetCache.js';

const cache = {value: undefined as LeaguePerkStylesData | undefined};

export async function getPerkStylesData(): Promise<LeaguePerkStylesData> {
    return getTypedAsset<LeaguePerkStylesData>(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json',
        'perkstyles.json',
        'perkstylesdata',
        cache
    );
}