import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

const { mockFs, mockAxios } = vi.hoisted(() => {
    const mockFs = {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        promises: {
            readFile: vi.fn(),
            writeFile: vi.fn(),
        }
    };
    const mockAxios = {
        get: vi.fn(),
    };
    return { mockFs, mockAxios };
});

vi.mock('fs', () => ({
    default: mockFs,
    ...mockFs,
}));

vi.mock('axios', () => ({
    default: mockAxios,
}));

vi.mock('@zeffuro/fakegaming-common/core', () => ({
    resolveDataRoot: () => '/test/data',
}));

import { getAssetCacheDir, getAsset } from '../assetCache.js';

describe('assetCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getAssetCacheDir', () => {
        it('should return cache directory path', () => {
            mockFs.existsSync.mockReturnValue(true);

            const result = getAssetCacheDir('champion');

            expect(result).toBe(path.join('/test/data', 'assets', 'champion'));
        });

        it('should create directory if it does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            mockFs.mkdirSync.mockReturnValue(undefined);

            const result = getAssetCacheDir('item');

            expect(mockFs.mkdirSync).toHaveBeenCalledWith(
                path.join('/test/data', 'assets', 'item'),
                { recursive: true }
            );
            expect(result).toBe(path.join('/test/data', 'assets', 'item'));
        });
    });

    describe('getAsset', () => {
        it('should return cached asset if it exists', async () => {
            const mockBuffer = Buffer.from('cached data');
            mockFs.existsSync.mockReturnValue(true);
            mockFs.promises.readFile.mockResolvedValue(mockBuffer);

            const result = await getAsset('https://example.com/asset.png', 'asset.png', 'champion');

            expect(result.buffer).toEqual(mockBuffer);
            expect(result.path).toBe(path.join('/test/data', 'assets', 'champion', 'asset.png'));
            expect(mockAxios.get).not.toHaveBeenCalled();
        });

        it('should fetch and cache asset if not cached', async () => {
            const mockData = Buffer.from('new data');
            mockFs.existsSync.mockReturnValue(false);
            mockAxios.get.mockResolvedValue({ data: mockData });
            mockFs.promises.writeFile.mockResolvedValue(undefined);

            const result = await getAsset('https://example.com/new.png', 'new.png', 'item');

            expect(mockAxios.get).toHaveBeenCalledWith('https://example.com/new.png', { responseType: 'arraybuffer' });
            expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
                path.join('/test/data', 'assets', 'item', 'new.png'),
                mockData
            );
            expect(result.buffer).toEqual(mockData);
        });

        it('should handle fetch errors gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockFs.existsSync.mockReturnValue(false);
            mockAxios.get.mockRejectedValue(new Error('Network error'));

            const result = await getAsset('https://example.com/error.png', 'error.png', 'champion');

            expect(result.buffer).toBeNull();
            expect(result.path).toBe(path.join('/test/data', 'assets', 'champion', 'error.png'));
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should handle non-Error exceptions', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockFs.existsSync.mockReturnValue(false);
            mockAxios.get.mockRejectedValue('String error');

            const result = await getAsset('https://example.com/error.png', 'error.png', 'item');

            expect(result.buffer).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch asset'),
                'String error'
            );
        });
    });
});