import { configManager } from '../../vitest.setup.js';

/**
 * Returns the id of the first Twitch config currently in the DB.
 * Throws if none exists to catch test data setup issues early.
 */
export async function getFirstTwitchId(): Promise<number> {
    const all = await configManager.twitchManager.getAllPlain();
    const id = all[0]?.id;
    if (typeof id !== 'number') throw new Error('No Twitch config found');
    return id;
}

