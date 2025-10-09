import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAugmentData } from '../leagueAugmentDataCache.js';
import * as typedAssetCache from '../../../../utils/typedAssetCache.js';

vi.mock('../../../../utils/typedAssetCache.js');

describe('leagueAugmentDataCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAugmentData', () => {
        it('should fetch augment data using typed asset cache', async () => {
            const mockData = [
                { id: 1, name: 'Augment 1' },
                { id: 2, name: 'Augment 2' },
            ];

            vi.mocked(typedAssetCache.getTypedAsset).mockResolvedValue(mockData);

            const result = await getAugmentData();

            expect(result).toEqual(mockData);
            expect(typedAssetCache.getTypedAsset).toHaveBeenCalledWith(
                'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json',
                'cherry-augments.json',
                'augmentdata',
                expect.any(Object)
            );
        });

        it('should handle empty augment data', async () => {
            vi.mocked(typedAssetCache.getTypedAsset).mockResolvedValue([]);

            const result = await getAugmentData();

            expect(result).toEqual([]);
        });
    });
});

