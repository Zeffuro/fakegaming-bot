/**
 * Redis cache implementation with lazy loading
 *
 * This file provides low-level Redis caching functionality.
 * It uses lazy loading to only initialize Redis when needed.
 */
import type { Redis, RedisOptions } from 'ioredis';

let redis: Redis | null = null;
let redisReady = false;
let connectingPromise: Promise<void> | null = null;

/**
 * Cache connection configuration
 */
export interface CacheConfig {
  /** Redis URL (e.g. redis://localhost:6379) */
  url?: string;
  /** Redis connection options */
  options?: RedisOptions;
}

/**
 * Initializes Redis connection with the provided URL
 * @param config - Redis configuration or connection URL
 * @returns Promise that resolves when Redis is ready
 */
export async function initRedis(config: string | CacheConfig): Promise<void> {
  const url = typeof config === 'string' ? config : config.url || '';
  const options = typeof config === 'object' ? config.options : undefined;

  if (!url && !options) {
    console.log('[cache] Redis configuration empty, skipping Redis initialization');
    return Promise.resolve();
  }

  if (!redis) {
    try {
      // Lazy-load Redis to avoid loading the module unless needed
      const IORedis = await import('ioredis');

      // Handle the dynamic import correctly with proper type handling
      if (url) {
        if (options) {
          redis = new IORedis.Redis(url, options);
        } else {
          redis = new IORedis.Redis(url);
        }
      } else if (options) {
        redis = new IORedis.Redis(options);
      }

      connectingPromise = new Promise<void>((resolve, reject) => {
        redis!.once('ready', () => {
          redisReady = true;
          console.log('[cache] Redis connected and ready.');
          resolve();
        });
        redis!.once('error', (err) => {
          redisReady = false;
          console.error('[cache] Redis error:', err);
          reject(err);
        });
      });
    } catch (error) {
      console.error('[cache] Failed to initialize Redis:', error);
      throw error;
    }
  }
  return connectingPromise!;
}

/**
 * Ensures Redis is connected before performing operations
 * @param config - Redis configuration or connection URL
 */
export async function ensureRedis(config?: string | CacheConfig): Promise<void> {
  const redisConfig = config || process.env.REDIS_URL || '';
  if (!redisConfig) return;

  if (!redis) {
    await initRedis(redisConfig);
    connectingPromise = null;
  } else if (!redisReady && connectingPromise) {
    await connectingPromise;
  }
}

/**
 * Gets a value from Redis cache
 * @param key - Cache key
 * @returns Parsed value from cache or null if not found
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  await ensureRedis();
  if (!redisReady) return null;

  try {
    const val = await redis!.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error('[cache] Redis GET failed for key', key, err);
    return null;
  }
}

/**
 * Sets a value in Redis cache with expiration
 * @param key - Cache key
 * @param value - Value to cache (will be JSON stringified)
 * @param ttlMs - Time to live in milliseconds
 */
export async function cacheSet(key: string, value: any, ttlMs: number): Promise<void> {
  await ensureRedis();
  if (!redisReady) return;

  try {
    await redis!.set(key, JSON.stringify(value), 'PX', ttlMs);
  } catch (err) {
    console.error('[cache] Redis SET failed for key', key, err);
  }
}

/**
 * Deletes a value from Redis cache
 * @param key - Cache key to delete
 */
export async function cacheDel(key: string): Promise<void> {
  await ensureRedis();
  if (!redisReady) return;

  try {
    await redis!.del(key);
  } catch (err) {
    console.error('[cache] Redis DEL failed for key', key, err);
  }
}

/**
 * Closes Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    redisReady = false;
  }
}
