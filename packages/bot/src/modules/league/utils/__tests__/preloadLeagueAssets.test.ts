import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preloadLeagueAssets } from '../preloadLeagueAssets.js';
import * as augmentCache from '../../cache/leagueAugmentDataCache.js';
import * as itemCache from '../../cache/leagueItemDataCache.js';
import * as perksCache from '../../cache/leaguePerksDataCache.js';
import * as perkStylesCache from '../../cache/leaguePerkStylesDataCache.js';
import * as summonerSpellCache from '../../cache/leagueSummonerSpellDataCache.js';

vi.mock('../../cache/leagueAugmentDataCache.js');
vi.mock('../../cache/leagueItemDataCache.js');
vi.mock('../../cache/leaguePerksDataCache.js');
vi.mock('../../cache/leaguePerkStylesDataCache.js');
vi.mock('../../cache/leagueSummonerSpellDataCache.js');

// --- local DRY helpers ---
function mockAllCachesResolved() {
    vi.mocked(augmentCache.getAugmentData).mockResolvedValue({} as any);
    vi.mocked(itemCache.getItemData).mockResolvedValue({} as any);
    vi.mocked(perksCache.getPerksData).mockResolvedValue({} as any);
    vi.mocked(perkStylesCache.getPerkStylesData).mockResolvedValue({} as any);
    vi.mocked(summonerSpellCache.getSummonerSpellData).mockResolvedValue({} as any);
}

describe('preloadLeagueAssets', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should preload all League assets', async () => {
        mockAllCachesResolved();

        await preloadLeagueAssets();

        expect(augmentCache.getAugmentData).toHaveBeenCalled();
        expect(itemCache.getItemData).toHaveBeenCalled();
        expect(perksCache.getPerksData).toHaveBeenCalled();
        expect(perkStylesCache.getPerkStylesData).toHaveBeenCalled();
        expect(summonerSpellCache.getSummonerSpellData).toHaveBeenCalled();
    });

    it('should log success message after preloading', async () => {
        mockAllCachesResolved();

        await preloadLeagueAssets();

        expect(console.log).toHaveBeenCalledWith('League assets preloaded!');
    });

    it('should load all assets in parallel', async () => {
        const delays = [100, 50, 75, 25, 10];
        let callIndex = 0;

        vi.mocked(augmentCache.getAugmentData).mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({} as any), delays[callIndex++]))
        );
        vi.mocked(itemCache.getItemData).mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({} as any), delays[callIndex++]))
        );
        vi.mocked(perksCache.getPerksData).mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({} as any), delays[callIndex++]))
        );
        vi.mocked(perkStylesCache.getPerkStylesData).mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({} as any), delays[callIndex++]))
        );
        vi.mocked(summonerSpellCache.getSummonerSpellData).mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({} as any), delays[callIndex++]))
        );

        const start = Date.now();
        await preloadLeagueAssets();
        const duration = Date.now() - start;

        // Should complete in roughly the time of the longest delay (100ms), not the sum
        expect(duration).toBeLessThan(200); // Allow some overhead
    });
});
