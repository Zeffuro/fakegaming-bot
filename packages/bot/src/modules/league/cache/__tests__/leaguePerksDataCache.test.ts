import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPerksData } from '../leaguePerksDataCache.js';
import * as typedAssetCache from '../../../../utils/typedAssetCache.js';

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

            vi.mocked(typedAssetCache.getTypedAsset).mockResolvedValue(mockData);

            const result = await getPerksData();

            expect(result).toEqual(mockData);
            expect(typedAssetCache.getTypedAsset).toHaveBeenCalledWith(
                'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json',
                'perks.json',
                'perkdata',
                expect.any(Object)
            );
        });

        it('should handle empty perks data', async () => {
            vi.mocked(typedAssetCache.getTypedAsset).mockResolvedValue([]);

            const result = await getPerksData();

            expect(result).toEqual([]);
        });
    });
});

