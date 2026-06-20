import {getAugmentData} from '../cache/leagueAugmentDataCache.js';
import {getItemData} from '../cache/leagueItemDataCache.js';
import {getPerksData} from '../cache/leaguePerksDataCache.js';
import {getPerkStylesData} from '../cache/leaguePerkStylesDataCache.js';
import {getSummonerSpellData} from '../cache/leagueSummonerSpellDataCache.js';
import {getLogger} from '@zeffuro/fakegaming-common';

const log = getLogger({ name: 'bot:league:preload' });

export async function preloadLeagueAssets() {
    await Promise.all([
        getAugmentData(),
        getItemData(),
        getPerksData(),
        getPerkStylesData(),
        getSummonerSpellData(),
    ]);
    log.info('League assets preloaded');
}
