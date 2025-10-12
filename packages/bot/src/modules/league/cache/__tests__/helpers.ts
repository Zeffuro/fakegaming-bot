import { expect, vi } from 'vitest';

/**
 * Mocks typedAssetCache.getTypedAsset to resolve with the given value.
 */
export async function mockGetTypedAssetResolved(value: unknown): Promise<void> {
    const mod = await import('../../../../utils/typedAssetCache.js');
    vi.mocked(mod.getTypedAsset).mockResolvedValue(value as any);
}

/**
 * Asserts that getTypedAsset was called with the expected url, filename, and cache key (first 3 args).
 */
export async function expectGetTypedAssetCalledWithPrefix(url: string, fileName: string, cacheKey: string): Promise<void> {
    const mod = await import('../../../../utils/typedAssetCache.js');
    const calls = (mod.getTypedAsset as any).mock?.calls as unknown[][] | undefined;
    expect(Array.isArray(calls)).toBe(true);
    expect((calls as unknown[]).length).toBeGreaterThan(0);
    const [firstUrl, firstFile, firstKey] = (calls as unknown[][])[0];
    expect(firstUrl).toBe(url);
    expect(firstFile).toBe(fileName);
    expect(firstKey).toBe(cacheKey);
}
