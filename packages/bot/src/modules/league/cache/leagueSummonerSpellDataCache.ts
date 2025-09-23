import {LeagueSummonerSpell} from '../types/leagueAssetTypes.js';
import {getTypedAsset} from '../../../utils/typedAssetCache.js';

const cache = {value: undefined as LeagueSummonerSpell[] | undefined};

export async function getSummonerSpellData(): Promise<LeagueSummonerSpell[]> {
    return getTypedAsset<LeagueSummonerSpell[]>(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json',
        'summoner-spells.json',
        'summonerspelldata',
        cache
    );
}