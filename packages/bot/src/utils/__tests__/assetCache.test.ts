import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAssetCacheDir, getAsset } from '../assetCache.js';
import fs from 'fs';
import axios from 'axios';
import path from 'path';

vi.mock('fs');
vi.mock('axios');
vi.mock('@zeffuro/fakegaming-common/core', () => ({
    resolveDataRoot: () => '/test/data',
}));

describe('assetCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getAssetCacheDir', () => {
        it('should return cache directory path', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);

            const result = getAssetCacheDir('champion');

            expect(result).toBe(path.join('/test/data', 'assets', 'champion'));
        });

        it('should create directory if it does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

            const result = getAssetCacheDir('item');

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                path.join('/test/data', 'assets', 'item'),
                { recursive: true }
            );
            expect(result).toBe(path.join('/test/data', 'assets', 'item'));
        });
    });

    describe('getAsset', () => {
        it('should return cached asset if it exists', async () => {
            const mockBuffer = Buffer.from('cached data');
            vi.mocked(fs.existsSync).mockReturnValue(true);
            const readFileSpy = vi.spyOn(fs.promises, 'readFile').mockResolvedValue(mockBuffer);

            const result = await getAsset('https://example.com/asset.png', 'asset.png', 'champion');

            expect(result.buffer).toEqual(mockBuffer);
            expect(result.path).toBe(path.join('/test/data', 'assets', 'champion', 'asset.png'));
            expect(axios.get).not.toHaveBeenCalled();

            readFileSpy.mockRestore();
        });

        it('should fetch and cache asset if not cached', async () => {
            const mockData = Buffer.from('new data');
            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(axios.get).mockResolvedValue({ data: mockData });
            const writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

            const result = await getAsset('https://example.com/new.png', 'new.png', 'item');

            expect(axios.get).toHaveBeenCalledWith('https://example.com/new.png', { responseType: 'arraybuffer' });
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                path.join('/test/data', 'assets', 'item', 'new.png'),
                mockData
            );
            expect(result.buffer).toEqual(mockData);

            writeFileSpy.mockRestore();
        });

        it('should handle fetch errors gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

            const result = await getAsset('https://example.com/error.png', 'error.png', 'champion');

            expect(result.buffer).toBeNull();
            expect(result.path).toBe(path.join('/test/data', 'assets', 'champion', 'error.png'));
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should handle non-Error exceptions', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(axios.get).mockRejectedValue('String error');

            const result = await getAsset('https://example.com/error.png', 'error.png', 'item');

            expect(result.buffer).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch asset'),
                'String error'
            );
        });
    });
});
