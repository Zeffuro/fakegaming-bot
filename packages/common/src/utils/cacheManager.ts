/**
 * High-level cache management utilities
 *
 * This file provides an abstraction layer over the low-level cache operations
 * with added functionality for common caching patterns.
 */
import { cacheGet, cacheSet, cacheDel, ensureRedis, type CacheConfig } from '../cache.js';

/**
 * Cache TTLs in milliseconds
 */
export const CACHE_TTL = {
  /** User profile cache duration - 24 hours */
  USER_PROFILE: 24 * 60 * 60 * 1000,
  /** User guilds cache duration - 1 hour */
  USER_GUILDS: 60 * 60 * 1000,
  /** Guild channels cache duration - 30 minutes */
  GUILD_CHANNELS: 30 * 60 * 1000,
  /** Access token cache duration - 1 hour (default) */
  ACCESS_TOKEN: 3600 * 1000,
  /** Bot guilds cache duration - 15 minutes */
  BOT_GUILDS: 15 * 60 * 1000
};

/**
 * Cache key generators for common data types
 */
export const CACHE_KEYS = {
  /** Generate cache key for user profile */
  userProfile: (userId: string) => `user:${userId}:profile`,
  /** Generate cache key for user guilds */
  userGuilds: (userId: string) => `user:${userId}:guilds`,
  /** Generate cache key for user access token */
  userAccessToken: (userId: string) => `user:${userId}:access_token`,
  /** Generate cache key for guild channels */
  guildChannels: (guildId: string) => `guild:${guildId}:channels`,
  /** Generate cache key for bot guilds */
  botGuilds: () => 'bot_guilds'
};

/**
 * Cache manager interface
 */
export interface CacheManager {
  /** Get a value from cache */
  get<T>(key: string): Promise<T | null>;
  /** Set a value in cache with TTL */
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  /** Delete a value from cache */
  del(key: string): Promise<void>;
  /** Get data from cache with fallback to fetch function */
  getCachedData<T>(key: string, fetchFn: () => Promise<T>, ttlMs: number): Promise<T | null>;
  /** Clear all cache keys for a user */
  clearUserCache(userId: string): Promise<void>;
}

/**
 * Create a cache manager instance
 *
 * @param config - Optional Redis configuration
 * @returns A cache manager instance
 *
 * @example
 * ```typescript
 * const cacheManager = getCacheManager({
 *   url: 'redis://localhost:6379'
 * });
 *
 * // Store a value in cache
 * await cacheManager.set('my-key', { data: 'value' }, 3600000); // 1 hour
 *
 * // Get a value with automatic fetching on cache miss
 * const data = await cacheManager.getCachedData(
 *   'my-key',
 *   async () => fetchDataFromApi(),
 *   3600000
 * );
 * ```
 */
export function getCacheManager(config?: CacheConfig): CacheManager {
  // Initialize Redis connection if config is provided
  if (config) {
    ensureRedis(config).catch(err => console.error('[CacheManager] Failed to initialize Redis:', err));
  }

  return {
    /**
     * Get a value from cache
     * @param key - Cache key
     * @returns Parsed value or null if not found
     */
    get: async <T>(key: string): Promise<T | null> => {
      return cacheGet<T>(key);
    },

    /**
     * Set a value in cache with TTL
     * @param key - Cache key
     * @param value - Value to store
     * @param ttlMs - Time to live in milliseconds
     */
    set: async <T>(key: string, value: T, ttlMs: number): Promise<void> => {
      return cacheSet(key, value, ttlMs);
    },

    /**
     * Delete a value from cache
     * @param key - Cache key to delete
     */
    del: async (key: string): Promise<void> => {
      return cacheDel(key);
    },

    /**
     * Get data from cache with fallback to fetch function
     * @param key - Cache key
     * @param fetchFn - Function to call on cache miss
     * @param ttlMs - Cache TTL in milliseconds
     * @returns The cached data or freshly fetched data
     */
    getCachedData: async <T>(
      key: string,
      fetchFn: () => Promise<T>,
      ttlMs: number
    ): Promise<T | null> => {
      try {
        // Try getting from cache
        const cachedData = await cacheGet<T>(key);
        if (cachedData) {
          return cachedData;
        }

        // Cache miss - fetch fresh data
        console.log(`[Cache] Miss for key ${key}, fetching fresh data`);
        const freshData = await fetchFn();

        // Store in cache if we got data
        if (freshData) {
          await cacheSet(key, freshData, ttlMs);
        }

        return freshData;
      } catch (error) {
        console.error(`[Cache] Error fetching data for key ${key}:`, error);
        return null;
      }
    },

    /**
     * Clear multiple cache keys for a user
     * @param userId - User ID to clear cache for
     */
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

// Export a default instance for backward compatibility
export const defaultCacheManager = getCacheManager();
