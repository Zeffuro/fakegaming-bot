/**
 * Tests for cache.ts Redis initialization and operations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockRedisConstructor, mockRedisInstance, flags, store } = vi.hoisted(() => {
    const store = new Map<string, string>();
    const flags = { throwGet: false, throwSet: false, throwDel: false };

    const mockRedisInstance = {
        once: vi.fn((event: string, cb: (arg?: unknown) => void) => {
            // Immediately signal ready; error is opt-in by tests via direct invocation
            if (event === 'ready') cb();
        }),
        get: vi.fn(async (key: string) => {
            if (flags.throwGet) throw new Error('get-error');
            return store.has(key) ? store.get(key)! : null;
        }),
        set: vi.fn(async (key: string, value: string, _mode?: string, _ttl?: number) => {
            if (flags.throwSet) throw new Error('set-error');
            store.set(key, value);
            return 'OK' as unknown as number; // ioredis returns string OK
        }),
        del: vi.fn(async (key: string) => {
            if (flags.throwDel) throw new Error('del-error');
            store.delete(key);
            return 1;
        }),
        quit: vi.fn(async () => {
            // no-op
        })
    } as const;

    const mockRedisConstructor = vi.fn(() => mockRedisInstance);
    return { mockRedisConstructor, mockRedisInstance, flags, store };
});

vi.mock('ioredis', () => ({
    default: mockRedisConstructor
}));

describe('initRedis', () => {
    beforeEach(() => {
        mockRedisConstructor.mockClear();
        mockRedisInstance.once.mockClear();
        vi.resetModules();
    });

    it('should initialize Redis with string config', async () => {
        const { initRedis } = await import('../cache.js');
        await initRedis('redis://localhost:6379');
        expect(mockRedisConstructor).toHaveBeenCalledWith('redis://localhost:6379');
    });

    it('should initialize Redis with object config', async () => {
        const { initRedis } = await import('../cache.js');
        const config = { url: 'redis://localhost:6379', options: { db: 1 } } as const;
        await initRedis(config);
        expect(mockRedisConstructor).toHaveBeenCalledWith('redis://localhost:6379', { db: 1 });
    });

    it('should skip initialization if config is empty', async () => {
        const { initRedis } = await import('../cache.js');
        await expect(initRedis({} as unknown as { url?: string })).resolves.toBeUndefined();
        expect(mockRedisConstructor).not.toHaveBeenCalled();
    });

    it('should handle repeated initialization gracefully', async () => {
        const { initRedis } = await import('../cache.js');
        await initRedis('redis://localhost:6379');
        await initRedis('redis://localhost:6379');
        expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
    });

    it('logs and throws if constructor fails', async () => {
        const { initRedis } = await import('../cache.js');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisConstructor.mockImplementationOnce(() => { throw new Error('boom'); });
        await expect(initRedis('redis://localhost:6379')).rejects.toThrow('boom');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('cache operations', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv, REDIS_URL: 'redis://localhost:6379' };
        store.clear();
        flags.throwGet = false;
        flags.throwSet = false;
        flags.throwDel = false;
        mockRedisConstructor.mockClear();
        mockRedisInstance.get.mockClear();
        mockRedisInstance.set.mockClear();
        mockRedisInstance.del.mockClear();
        mockRedisInstance.quit.mockClear();
        mockRedisInstance.once.mockClear();
        vi.resetModules();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('cacheSet then cacheGet round-trips JSON and respects TTL option', async () => {
        const { cacheSet, cacheGet } = await import('../cache.js');
        const value = { a: 1, b: 'two' };

        await cacheSet('k1', value, 1500);
        expect(mockRedisInstance.set).toHaveBeenCalledWith('k1', JSON.stringify(value), 'PX', 1500);

        const result = await cacheGet<typeof value>('k1');
        expect(result).toEqual(value);
        expect(mockRedisInstance.get).toHaveBeenCalledWith('k1');
    });

    it('cacheDel removes key', async () => {
        const { cacheSet, cacheDel, cacheGet } = await import('../cache.js');
        await cacheSet('k2', { x: true }, 5000);
        await cacheDel('k2');
        expect(mockRedisInstance.del).toHaveBeenCalledWith('k2');
        const result = await cacheGet('k2');
        expect(result).toBeNull();
    });

    it('gracefully handles GET/SET/DEL errors and logs them', async () => {
        const { cacheSet, cacheGet, cacheDel } = await import('../cache.js');
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        flags.throwSet = true;
        await cacheSet('k3', { y: 2 }, 1000); // should not throw
        expect(errSpy).toHaveBeenCalled();

        flags.throwGet = true;
        const got = await cacheGet('k3');
        expect(got).toBeNull();
        expect(errSpy).toHaveBeenCalled();

        flags.throwDel = true;
        await cacheDel('k3'); // should not throw
        expect(errSpy).toHaveBeenCalled();

        errSpy.mockRestore();
    });

    it('returns null/no-op when Redis is not configured/ready', async () => {
        // No REDIS_URL
        process.env.REDIS_URL = '';
        const { cacheGet, cacheSet, cacheDel } = await import('../cache.js');
        const g = await cacheGet('missing');
        expect(g).toBeNull();
        // The following should be no-ops
        await cacheSet('k4', { z: 3 }, 100);
        await cacheDel('k4');
        // Constructor should never be called when env is empty
        expect(mockRedisConstructor).not.toHaveBeenCalled();
    });

    it('closeRedis calls quit and resets state for fresh init', async () => {
        const { cacheSet, closeRedis, initRedis } = await import('../cache.js');
        await initRedis('redis://localhost:6379');
        await cacheSet('k5', { ok: true }, 1000);
        expect(mockRedisInstance.set).toHaveBeenCalled();

        await closeRedis();
        expect(mockRedisInstance.quit).toHaveBeenCalled();

        // Re-init should construct again after close
        await initRedis('redis://localhost:6379');
        expect(mockRedisConstructor).toHaveBeenCalledTimes(2);
    });
});
