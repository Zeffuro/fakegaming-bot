import {preloadLeagueAssets} from '../modules/league/utils/preloadLeagueAssets.js';
import {getLogger} from '@zeffuro/fakegaming-common';

const log = getLogger({ name: 'bot:preload' });

/**
 * Preloads all modules required for the bot to function (e.g., assets, data).
 * Runs each preloader and logs errors if any occur.
 */
export async function preloadAllModules() {
    const preloads = [
        preloadLeagueAssets
    ];

    for (const preloader of preloads) {
        try {
            await preloader();
        } catch (err) {
            log.error({ err }, 'Error preloading module');
        }
    }
    log.info('All modules preloaded');
}
