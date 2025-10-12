import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPerkStylesData } from '../leaguePerkStylesDataCache.js';
import { mockGetTypedAssetResolved, expectGetTypedAssetCalledWithPrefix } from './helpers.js';

vi.mock('../../../../utils/typedAssetCache.js');

describe('leaguePerkStylesDataCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getPerkStylesData', () => {
        it('should fetch perk styles data using typed asset cache', async () => {
            const mockData = {
                styles: [
                    { id: 8000, name: 'Precision' },
                    { id: 8100, name: 'Domination' },
                ],
            };

            await mockGetTypedAssetResolved(mockData);

            const result = await getPerkStylesData();

            expect(result).toEqual(mockData);
            await expectGetTypedAssetCalledWithPrefix(
                'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json',
                'perkstyles.json',
                'perkstylesdata'
            );
        });

        it('should handle empty perk styles data', async () => {
            await mockGetTypedAssetResolved({ styles: [] });

            const result = await getPerkStylesData();

            expect(result).toEqual({ styles: [] });
        });
    });
});
