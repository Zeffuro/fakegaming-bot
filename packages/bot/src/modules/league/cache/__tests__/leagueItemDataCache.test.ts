import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getItemData } from '../leagueItemDataCache.js';
import * as typedAssetCache from '../../../../utils/typedAssetCache.js';

vi.mock('../../../../utils/typedAssetCache.js');

describe('leagueItemDataCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getItemData', () => {
        it('should fetch item data using typed asset cache', async () => {
            const mockData = [
                { id: 1001, name: 'Boots' },
                { id: 3031, name: 'Infinity Edge' },
            ];

            vi.mocked(typedAssetCache.getTypedAsset).mockResolvedValue(mockData);

            const result = await getItemData();

            expect(result).toEqual(mockData);
            expect(typedAssetCache.getTypedAsset).toHaveBeenCalledWith(
                'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json',
                'items.json',
                'itemdata',
                expect.any(Object)
            );
        });

        it('should handle empty item data', async () => {
            vi.mocked(typedAssetCache.getTypedAsset).mockResolvedValue([]);

            const result = await getItemData();

            expect(result).toEqual([]);
        });
    });
});

