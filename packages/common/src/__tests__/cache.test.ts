/**
 * Tests for cache.ts Redis initialization
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedisConstructor, mockRedisInstance } = vi.hoisted(() => {
    const mockRedisInstance = {
        once: vi.fn((event: string, cb: () => void) => {
            if (event === 'ready') cb();
        }),
        quit: vi.fn()
    };
    const mockRedisConstructor = vi.fn(() => mockRedisInstance);
    return { mockRedisConstructor, mockRedisInstance };
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
        const config = { url: 'redis://localhost:6379', options: { db: 1 } };
        await initRedis(config);
        expect(mockRedisConstructor).toHaveBeenCalledWith('redis://localhost:6379', { db: 1 });
    });

    it('should skip initialization if config is empty', async () => {
        const { initRedis } = await import('../cache.js');
        await expect(initRedis({})).resolves.toBeUndefined();
        expect(mockRedisConstructor).not.toHaveBeenCalled();
    });

    it('should handle repeated initialization gracefully', async () => {
        const { initRedis } = await import('../cache.js');
        await initRedis('redis://localhost:6379');
        await initRedis('redis://localhost:6379');
        expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
    });

    // Add more tests for error handling and edge cases as needed
});
