import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';
let redis: Redis | null = null;
let redisReady = false;

if (REDIS_URL) {
  redis = new Redis(REDIS_URL);
  redis.on('ready', () => { redisReady = true; });
  redis.on('error', () => { redisReady = false; });
}

// In-memory fallback cache
const memoryCache: Record<string, { value: any; expires: number }> = {};

function warnFallback() {
  if (!redisReady && !warnFallback.warned) {
    console.warn('[cache] Redis unavailable, using in-memory fallback.');
    warnFallback.warned = true;
  }
}
warnFallback.warned = false;

export async function cacheGet(key: string): Promise<any | null> {
  if (redis && redisReady) {
    try {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      warnFallback();
    }
  }
  warnFallback();
  const entry = memoryCache[key];
  if (entry && entry.expires > Date.now()) {
    return entry.value;
  }
  return null;
}

export async function cacheSet(key: string, value: any, ttlMs: number): Promise<boolean> {
  if (redis && redisReady) {
    try {
      await redis.set(key, JSON.stringify(value), 'PX', ttlMs);
      return true;
    } catch {
      warnFallback();
    }
  }
  warnFallback();
  memoryCache[key] = { value, expires: Date.now() + ttlMs };
  return true;
}

export async function cacheDel(key: string): Promise<boolean> {
  if (redis && redisReady) {
    try {
      await redis.del(key);
      return true;
    } catch {
      warnFallback();
    }
  }
  warnFallback();
  delete memoryCache[key];
  return true;
}

