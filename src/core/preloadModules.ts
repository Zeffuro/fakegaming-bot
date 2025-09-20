import {preloadLeagueAssets} from '../modules/league/utils/preloadLeagueAssets.js';

export async function preloadAllModules() {
    const preloaders = [
        preloadLeagueAssets
    ];

    for (const preloader of preloaders) {
        try {
            await preloader();
        } catch (err) {
            console.error(`Error preloading module:`, err);
        }
    }
    console.log("All modules preloaded!");
}