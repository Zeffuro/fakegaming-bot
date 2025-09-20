import {LeaguePerk} from '../types/leagueAssetTypes.js';
import {getTypedAsset} from '../../../utils/typedAssetCache.js';

const cache = {value: undefined as LeaguePerk[] | undefined};

export async function getPerksData(): Promise<LeaguePerk[]> {
    return getTypedAsset<LeaguePerk[]>(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json',
        'perks.json',
        'perkdata',
        cache
    );
}