import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getItemData } from '../leagueItemDataCache.js';
import { mockGetTypedAssetResolved, expectGetTypedAssetCalledWithPrefix } from './helpers.js';

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

            await mockGetTypedAssetResolved(mockData);

            const result = await getItemData();

            expect(result).toEqual(mockData);
            await expectGetTypedAssetCalledWithPrefix(
                'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json',
                'items.json',
                'itemdata'
            );
        });

        it('should handle empty item data', async () => {
            await mockGetTypedAssetResolved([]);

            const result = await getItemData();

            expect(result).toEqual([]);
        });
    });
});
