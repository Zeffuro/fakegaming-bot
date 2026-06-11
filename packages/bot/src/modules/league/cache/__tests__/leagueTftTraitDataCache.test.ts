import {describe, it, expect, vi, beforeEach} from 'vitest';
import {getTftTraitData} from '../leagueTftTraitDataCache.js';
import {expectGetTypedAssetCalledWithPrefix, mockGetTypedAssetResolved} from './helpers.js';

vi.mock('../../../../utils/typedAssetCache.js');

describe('leagueTftTraitDataCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches TFT trait data using typed asset cache', async () => {
        const mockData = [
            {
                display_name: 'Hoverboard',
                trait_id: 'TFT13_Hoverboard',
                icon_path: '/lol-game-data/assets/ASSETS/UX/TraitIcons/Trait_Icon_13_Hoverboard.TFT_Set13.png',
            },
        ];

        await mockGetTypedAssetResolved(mockData);

        const result = await getTftTraitData();

        expect(result).toEqual(mockData);
        await expectGetTypedAssetCalledWithPrefix(
            'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/tfttraits.json',
            'tfttraits.json',
            'tfttraitdata'
        );
    });
});
