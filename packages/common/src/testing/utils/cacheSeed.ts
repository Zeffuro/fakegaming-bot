import { CACHE_KEYS, CACHE_TTL, defaultCacheManager, type CacheManager } from '../../utils/cacheManager.js';
import type { MinimalGuildData, DiscordUserProfile } from '../../discord/types.js';

function getTestAwareCache(): CacheManager {
    const g: any = globalThis as any;
    return (g && g.__testCacheManager ? g.__testCacheManager : defaultCacheManager) as CacheManager;
}

/**
 * Seeds the authenticated user's guilds (with permissions) into the cache.
 * Uses the same cache instance as the API (prefers the global test cache).
 */
export async function seedUserGuilds(
    discordId: string,
    guilds: Array<Pick<MinimalGuildData, 'id' | 'permissions' | 'owner'>>,
    options: { cache?: Pick<CacheManager, 'set'>; ttlMs?: number } = {}
): Promise<void> {
    const testCache = options.cache ?? getTestAwareCache();
    const ttl = typeof options.ttlMs === 'number' ? options.ttlMs : CACHE_TTL.USER_GUILDS;
    await testCache.set(CACHE_KEYS.userGuilds(discordId), guilds as MinimalGuildData[], ttl);
    // Also set on defaultCacheManager if it's a different instance, to cover all code paths
    if ((defaultCacheManager as any) !== (testCache as any)) {
        await defaultCacheManager.set(CACHE_KEYS.userGuilds(discordId), guilds as MinimalGuildData[], ttl);
    }
}

/**
 * Seed one or more user profiles into cache.
 */
export async function seedUserProfiles(
    profiles: DiscordUserProfile[],
    options: { cache?: Pick<CacheManager, 'set'>; ttlMs?: number } = {}
): Promise<void> {
    const testCache = options.cache ?? getTestAwareCache();
    const ttl = typeof options.ttlMs === 'number' ? options.ttlMs : CACHE_TTL.USER_PROFILE;
    for (const p of profiles) {
        await testCache.set(CACHE_KEYS.userProfile(p.id), p, ttl);
        if ((defaultCacheManager as any) !== (testCache as any)) {
            await defaultCacheManager.set(CACHE_KEYS.userProfile(p.id), p, ttl);
        }
    }
}

/**
 * Seed a user's guild nickname into cache.
 */
export async function seedUserGuildNick(
    userId: string,
    guildId: string,
    nick: string | null,
    options: { cache?: Pick<CacheManager, 'set'>; ttlMs?: number } = {}
): Promise<void> {
    const testCache = options.cache ?? getTestAwareCache();
    const ttl = typeof options.ttlMs === 'number' ? options.ttlMs : CACHE_TTL.USER_PROFILE;
    await testCache.set(CACHE_KEYS.userGuildNick(userId, guildId), nick, ttl);
    if ((defaultCacheManager as any) !== (testCache as any)) {
        await defaultCacheManager.set(CACHE_KEYS.userGuildNick(userId, guildId), nick, ttl);
    }
}
