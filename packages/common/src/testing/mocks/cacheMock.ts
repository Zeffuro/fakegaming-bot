import {afterEach, beforeEach, vi} from 'vitest';
import type {MinimalGuildData} from '../../discord/types.js';

/**
 * Default mocked user guilds used in tests
 */
function getDefaultUserGuilds(): MinimalGuildData[] {
    return [
        { id: 'guild1', owner: true, permissions: '8' },
        { id: 'guild2', owner: false, permissions: '0' }
    ];
}

/**
 * Mock implementation for cacheGet during tests
 */
export const mockCacheGet = vi.fn<(key: string) => Promise<any>>()
    .mockImplementation(async (key: string) => {
        // Return admin access for any user guilds key by default
        if (/^user:.+:guilds$/.test(key)) {
            return getDefaultUserGuilds();
        }
        return null;
    });

/**
 * Mock implementation for cacheSet during tests
 */
export const mockCacheSet = vi.fn<(key: string, value: any, ttlMs?: number) => Promise<void>>()
    .mockResolvedValue(undefined);

/**
 * Mock implementation for cacheDelete during tests
 */
export const mockCacheDelete = vi.fn<(key: string) => Promise<void>>()
    .mockResolvedValue(undefined);

/**
 * Set up mock for the common cache functions and defaultCacheManager
 *
 * We partially mock the module to preserve all real exports (Discord, validation,
 * error classes, etc.) and only override the cache helpers + default cache manager.
 */
export function setupCacheMocks(): void {
    vi.mock('@zeffuro/fakegaming-common', async (importOriginal: () => Promise<typeof import('@zeffuro/fakegaming-common')>) => {
        const actualModule = await importOriginal();

        const defaultCacheManager = {
            get: async <T>(key: string): Promise<T | null> => mockCacheGet(key),
            set: async <T>(_key: string, _value: T, _ttlMs: number): Promise<void> => {},
            del: async (_key: string): Promise<void> => {},
            getCachedData: async <T>(_key: string, fetchFn: () => Promise<T>, _ttlMs: number): Promise<T | null> => fetchFn(),
            clearUserCache: async (_userId: string): Promise<void> => {},
        };

        return {
            ...actualModule,
            // expose cache helpers
            cacheGet: mockCacheGet,
            cacheSet: mockCacheSet,
            cacheDelete: mockCacheDelete,
            // minimal cache manager implementation
            defaultCacheManager,
        };
    });
}

/**
 * Reset cache mocks to their default state
 */
export function resetCacheMocks(): void {
    mockCacheGet.mockReset().mockImplementation(async (key: string) => {
        if (/^user:.+:guilds$/.test(key)) {
            return getDefaultUserGuilds();
        }
        return null;
    });
    mockCacheSet.mockReset().mockResolvedValue(undefined);
    mockCacheDelete.mockReset().mockResolvedValue(undefined);
}

/**
 * Helper to setup and teardown cache mocks for a test suite
 */
export function withCacheMocks() {
    beforeEach(() => {
        setupCacheMocks();
    });

    afterEach(() => {
        resetCacheMocks();
    });
}
