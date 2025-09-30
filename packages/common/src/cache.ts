import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';
let redis: Redis | null = null;
let redisReady = false;

if (REDIS_URL) {
    redis = new Redis(REDIS_URL);
    redis.on('ready', () => {
        redisReady = true;
        console.log('[cache] Redis connected and ready.');
    });
    redis.on('error', (err: unknown) => {
        redisReady = false;
        console.error('[cache] Redis error:', err);
    });
} else {
    console.warn('[cache] No REDIS_URL provided, cache is disabled.');
}

/**
 * Get a value from Redis cache.
 * Returns null if key is missing or Redis is unavailable.
 */
export async function cacheGet(key: string): Promise<any | null> {
    if (!redis || !redisReady) return null;

    try {
        const val = await redis.get(key);
        return val ? JSON.parse(val) : null;
    } catch (err) {
        console.error('[cache] Redis GET failed for key', key, err);
        return null;
    }
}

/**
 * Set a value in Redis cache with TTL in milliseconds.
 * Does nothing if Redis is unavailable.
 */
export async function cacheSet(key: string, value: any, ttlMs: number): Promise<void> {
    if (!redis || !redisReady) return;

    try {
        await redis.set(key, JSON.stringify(value), 'PX', ttlMs);
    } catch (err) {
        console.error('[cache] Redis SET failed for key', key, err);
    }
}

/**
 * Delete a key from Redis cache.
 * Does nothing if Redis is unavailable.
 */
export async function cacheDel(key: string): Promise<void> {
    if (!redis || !redisReady) return;

    try {
        await redis.del(key);
    } catch (err) {
        console.error('[cache] Redis DEL failed for key', key, err);
    }
}
