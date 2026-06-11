import {getTypedAsset} from '../../../utils/typedAssetCache.js';
import type {TftTrait} from '../types/leagueAssetTypes.js';

const cache = {value: undefined as TftTrait[] | undefined};

export async function getTftTraitData(): Promise<TftTrait[]> {
    return getTypedAsset<TftTrait[]>(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/tfttraits.json',
        'tfttraits.json',
        'tfttraitdata',
        cache
    );
}
