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

async function tryRedisGet(key: string): Promise<any | null> {
  if (!redis || !redisReady) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function tryRedisSet(key: string, value: any, ttlMs: number): Promise<boolean> {
  if (!redis || !redisReady) return false;
  try {
    await redis.set(key, JSON.stringify(value), 'PX', ttlMs);
    return true;
  } catch {
    return false;
  }
}

async function tryRedisDel(key: string): Promise<boolean> {
  if (!redis || !redisReady) return false;
  try {
    await redis.del(key);
    return true;
  } catch {
    return false;
  }
}

export async function getCache(key: string): Promise<any | null> {
  const redisVal = await tryRedisGet(key);
  if (redisVal !== null) return redisVal;
  const entry = memoryCache[key];
  return entry && entry.expires > Date.now() ? entry.value : null;
}

export async function setCache(key: string, value: any, ttlMs: number): Promise<void> {
  if (await tryRedisSet(key, value, ttlMs)) return;
  memoryCache[key] = { value, expires: Date.now() + ttlMs };
}

export async function deleteCache(key: string): Promise<void> {
  if (await tryRedisDel(key)) return;
  delete memoryCache[key];
}
