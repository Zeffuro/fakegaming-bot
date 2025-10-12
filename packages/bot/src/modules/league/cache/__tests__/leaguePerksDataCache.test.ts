import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPerksData } from '../leaguePerksDataCache.js';
import { mockGetTypedAssetResolved, expectGetTypedAssetCalledWithPrefix } from './helpers.js';

vi.mock('../../../../utils/typedAssetCache.js');

describe('leaguePerksDataCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getPerksData', () => {
        it('should fetch perks data using typed asset cache', async () => {
            const mockData = [
                { id: 8005, name: 'Press the Attack' },
                { id: 8008, name: 'Lethal Tempo' },
            ];

            await mockGetTypedAssetResolved(mockData);

            const result = await getPerksData();

            expect(result).toEqual(mockData);
            await expectGetTypedAssetCalledWithPrefix(
                'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json',
                'perks.json',
                'perkdata'
            );
        });

        it('should handle empty perks data', async () => {
            await mockGetTypedAssetResolved([]);

            const result = await getPerksData();

            expect(result).toEqual([]);
        });
    });
});
