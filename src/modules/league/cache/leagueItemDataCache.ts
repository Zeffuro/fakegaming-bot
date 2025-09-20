import {LeagueItem} from '../types/leagueAssetTypes.js';
import {getTypedAsset} from '../../../utils/typedAssetCache.js';

const cache = {value: undefined as LeagueItem[] | undefined};

export async function getItemData(): Promise<LeagueItem[]> {
    return getTypedAsset<LeagueItem[]>(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json',
        'items.json',
        'itemdata',
        cache
    );
}