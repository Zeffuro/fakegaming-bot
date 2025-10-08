import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTypedAsset } from '../typedAssetCache.js';

vi.mock('../assetCache.js', () => ({
    getAsset: vi.fn(),
}));

describe('typedAssetCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getTypedAsset', () => {
        it('should return cached value if already loaded', async () => {
            const cacheVar = { value: { data: 'cached' } };
            const assetCache = await import('../assetCache.js');

            const result = await getTypedAsset('https://example.com/data.json', 'data.json', 'testkey', cacheVar);

            expect(result).toEqual({ data: 'cached' });
            expect(assetCache.getAsset).not.toHaveBeenCalled();
        });

        it('should load and cache asset if not cached', async () => {
            const cacheVar = { value: undefined };
            const mockBuffer = Buffer.from(JSON.stringify({ items: ['item1', 'item2'] }));
            const assetCache = await import('../assetCache.js');
            vi.mocked(assetCache.getAsset).mockResolvedValue({
                buffer: mockBuffer,
                path: '/cache/data.json',
            });

            const result = await getTypedAsset('https://example.com/data.json', 'data.json', 'testkey', cacheVar);

            expect(assetCache.getAsset).toHaveBeenCalledWith('https://example.com/data.json', 'data.json', 'testkey');
            expect(result).toEqual({ items: ['item1', 'item2'] });
            expect(cacheVar.value).toEqual({ items: ['item1', 'item2'] });
        });

        it('should throw error if buffer is null', async () => {
            const cacheVar = { value: undefined };
            const assetCache = await import('../assetCache.js');
            vi.mocked(assetCache.getAsset).mockResolvedValue({
                buffer: null,
                path: '/cache/data.json',
            });

            await expect(
                getTypedAsset('https://example.com/data.json', 'data.json', 'testkey', cacheVar)
            ).rejects.toThrow('Asset buffer for data.json is null');
        });

        it('should parse JSON from buffer correctly', async () => {
            const cacheVar = { value: undefined };
            const complexData = {
                version: '1.0.0',
                items: [
                    { id: 1, name: 'Item 1' },
                    { id: 2, name: 'Item 2' },
                ],
                metadata: { count: 2 },
            };
            const mockBuffer = Buffer.from(JSON.stringify(complexData));
            const assetCache = await import('../assetCache.js');
            vi.mocked(assetCache.getAsset).mockResolvedValue({
                buffer: mockBuffer,
                path: '/cache/complex.json',
            });

            const result = await getTypedAsset<typeof complexData>(
                'https://example.com/complex.json',
                'complex.json',
                'complex',
                cacheVar
            );

            expect(result).toEqual(complexData);
        });
    });
});
