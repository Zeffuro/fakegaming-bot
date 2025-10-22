import { configManager } from '../../vitest.setup.js';

/** Returns the id of the first TikTok config currently in the DB. */
export async function getFirstTikTokId(): Promise<number> {
    const all = await configManager.tiktokManager.getAllPlain();
    const id = all[0]?.id;
    if (typeof id !== 'number') throw new Error('No TikTok config found');
    return id;
}

