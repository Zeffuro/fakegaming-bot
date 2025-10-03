// filepath: F:\Coding\discord-bot\packages\common\src\testing\mocks\cacheMock.ts
import { vi, beforeEach, afterEach } from 'vitest';

/**
 * Mock implementation for cacheGet during tests
 */
export const mockCacheGet = vi.fn<() => Promise<string[]>>()
    .mockResolvedValue(['testguild1', 'testguild2']);

/**
 * Mock implementation for cacheSet during tests
 */
export const mockCacheSet = vi.fn<(key: string, value: any) => Promise<void>>()
    .mockResolvedValue(undefined);

/**
 * Mock implementation for cacheDelete during tests
 */
export const mockCacheDelete = vi.fn<(key: string) => Promise<void>>()
    .mockResolvedValue(undefined);

/**
 * Set up mock for the common cache functions
 */
export function setupCacheMocks(): void {
    vi.mock('@zeffuro/fakegaming-common', async (importOriginal: () => Promise<typeof import('@zeffuro/fakegaming-common')>) => {
        const actualModule = await importOriginal();
        return {
            ...actualModule,
            cacheGet: mockCacheGet,
            cacheSet: mockCacheSet,
            cacheDelete: mockCacheDelete,
        };
    });
}

/**
 * Reset cache mocks to their default state
 */
export function resetCacheMocks(): void {
    mockCacheGet.mockReset().mockResolvedValue(['testguild1', 'testguild2']);
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
