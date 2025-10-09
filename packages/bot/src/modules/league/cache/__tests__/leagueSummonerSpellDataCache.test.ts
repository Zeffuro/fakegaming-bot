import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSummonerSpellData } from '../leagueSummonerSpellDataCache.js';
import * as typedAssetCache from '../../../../utils/typedAssetCache.js';

vi.mock('../../../../utils/typedAssetCache.js');

describe('leagueSummonerSpellDataCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getSummonerSpellData', () => {
        it('should fetch summoner spell data using typed asset cache', async () => {
            const mockData = [
                { id: 4, name: 'Flash' },
                { id: 14, name: 'Ignite' },
            ];

            vi.mocked(typedAssetCache.getTypedAsset).mockResolvedValue(mockData);

            const result = await getSummonerSpellData();

            expect(result).toEqual(mockData);
            expect(typedAssetCache.getTypedAsset).toHaveBeenCalledWith(
                'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json',
                'summoner-spells.json',
                'summonerspelldata',
                expect.any(Object)
            );
        });

        it('should handle empty summoner spell data', async () => {
            vi.mocked(typedAssetCache.getTypedAsset).mockResolvedValue([]);

            const result = await getSummonerSpellData();

            expect(result).toEqual([]);
        });
    });
});
