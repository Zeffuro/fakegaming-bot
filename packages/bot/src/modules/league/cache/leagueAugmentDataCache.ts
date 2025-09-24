import {LeagueAugment} from '../types/leagueAssetTypes.js';
import {getTypedAsset} from '../../../utils/typedAssetCache.js';

const cache = {value: undefined as LeagueAugment[] | undefined};

export async function getAugmentData(): Promise<LeagueAugment[]> {
    return getTypedAsset<LeagueAugment[]>(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json',
        'cherry-augments.json',
        'augmentdata',
        cache
    );
}