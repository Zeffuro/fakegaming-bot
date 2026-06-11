import {getTypedAsset} from '../../../utils/typedAssetCache.js';
import type {TftItem} from '../types/leagueAssetTypes.js';

const cache = {value: undefined as TftItem[] | undefined};

export async function getTftItemData(): Promise<TftItem[]> {
    return getTypedAsset<TftItem[]>(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/tftitems.json',
        'tftitems.json',
        'tftitemdata',
        cache
    );
}
