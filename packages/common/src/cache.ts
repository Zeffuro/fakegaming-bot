/**
 * Redis cache implementation with lazy loading
 */
import type { Redis, RedisOptions } from 'ioredis';

let redis: Redis | null = null;
let redisReady = false;
let connectingPromise: Promise<void> | null = null;

export interface CacheConfig {
  url?: string;
  options?: RedisOptions;
}

/**
 * Initializes Redis connection with the provided configuration
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
      const ioredisModule = await import('ioredis');

      const RedisConstructor = (ioredisModule.default || ioredisModule) as unknown as {
        new (url: string, options?: RedisOptions): Redis;
        new (options: RedisOptions): Redis;
      };

      if (url) {
        if (options) {
          redis = new RedisConstructor(url, options);
        } else {
          redis = new RedisConstructor(url);
        }
      } else if (options) {
        redis = new RedisConstructor(options);
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

export async function cacheSet(key: string, value: any, ttlMs: number): Promise<void> {
  await ensureRedis();
  if (!redisReady) return;

  try {
    await redis!.set(key, JSON.stringify(value), 'PX', ttlMs);
  } catch (err) {
    console.error('[cache] Redis SET failed for key', key, err);
  }
}

export async function cacheDel(key: string): Promise<void> {
  await ensureRedis();
  if (!redisReady) return;

  try {
    await redis!.del(key);
  } catch (err) {
    console.error('[cache] Redis DEL failed for key', key, err);
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    redisReady = false;
  }
}
