import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSummonerSpellData } from '../leagueSummonerSpellDataCache.js';
import { mockGetTypedAssetResolved, expectGetTypedAssetCalledWithPrefix } from './helpers.js';

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

            await mockGetTypedAssetResolved(mockData);

            const result = await getSummonerSpellData();

            expect(result).toEqual(mockData);
            await expectGetTypedAssetCalledWithPrefix(
                'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json',
                'summoner-spells.json',
                'summonerspelldata'
            );
        });

        it('should handle empty summoner spell data', async () => {
            await mockGetTypedAssetResolved([]);

            const result = await getSummonerSpellData();

            expect(result).toEqual([]);
        });
    });
});
