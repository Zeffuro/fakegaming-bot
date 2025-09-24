import {preloadLeagueAssets} from '../modules/league/utils/preloadLeagueAssets.js';

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
            console.error(`Error preloading module:`, err);
        }
    }
    console.log("All modules preloaded!");
}