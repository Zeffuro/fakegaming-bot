/**
 * High-level cache management utilities
 *
 * This file provides an abstraction layer over the low-level cache operations
 * with added functionality for common caching patterns.
 */
import { cacheGet, cacheSet, cacheDel, ensureRedis, type CacheConfig } from '../cache.js';

export const CACHE_TTL = {
  USER_PROFILE: 24 * 60 * 60 * 1000,    // 24 hours
  USER_GUILDS: 60 * 60 * 1000,          // 1 hour
  GUILD_CHANNELS: 30 * 60 * 1000,       // 30 minutes
  ACCESS_TOKEN: 3600 * 1000,            // 1 hour
  BOT_GUILDS: 15 * 60 * 1000            // 15 minutes
};

export const CACHE_KEYS = {
  userProfile: (userId: string) => `user:${userId}:profile`,
  userGuilds: (userId: string) => `user:${userId}:guilds`,
  userAccessToken: (userId: string) => `user:${userId}:access_token`,
  guildChannels: (guildId: string) => `guild:${guildId}:channels`,
  botGuilds: () => 'bot_guilds'
};

export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
  getCachedData<T>(key: string, fetchFn: () => Promise<T>, ttlMs: number): Promise<T | null>;
  clearUserCache(userId: string): Promise<void>;
}

export function getCacheManager(config?: CacheConfig): CacheManager {
  if (config) {
    ensureRedis(config).catch(err => console.error('[CacheManager] Failed to initialize Redis:', err));
  }

  return {
    get: async <T>(key: string): Promise<T | null> => {
      return cacheGet<T>(key);
    },

    set: async <T>(key: string, value: T, ttlMs: number): Promise<void> => {
      return cacheSet(key, value, ttlMs);
    },

    del: async (key: string): Promise<void> => {
      return cacheDel(key);
    },

    getCachedData: async <T>(
      key: string,
      fetchFn: () => Promise<T>,
      ttlMs: number
    ): Promise<T | null> => {
      try {
        const cachedData = await cacheGet<T>(key);
        if (cachedData) {
          return cachedData;
        }

        console.log(`[Cache] Miss for key ${key}, fetching fresh data`);
        const freshData = await fetchFn();

        if (freshData) {
          await cacheSet(key, freshData, ttlMs);
        }

        return freshData;
      } catch (error) {
        console.error(`[Cache] Error fetching data for key ${key}:`, error);
        return null;
      }
    },

    clearUserCache: async (userId: string): Promise<void> => {
      try {
        await cacheDel(CACHE_KEYS.userProfile(userId));
        await cacheDel(CACHE_KEYS.userGuilds(userId));
        await cacheDel(CACHE_KEYS.userAccessToken(userId));
        console.log(`[Cache] Cleared cache for user ${userId}`);
      } catch (error) {
        console.error(`[Cache] Error clearing cache for user ${userId}:`, error);
      }
    }
  };
}

export const defaultCacheManager = getCacheManager();
