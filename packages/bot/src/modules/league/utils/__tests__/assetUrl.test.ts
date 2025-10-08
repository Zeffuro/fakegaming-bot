import { describe, it, expect } from 'vitest';
import { leagueChampionIconUrl, tftUnitIconUrl, communityDragonAssetUrl } from '../assetUrl.js';

describe('assetUrl', () => {
    describe('leagueChampionIconUrl', () => {
        it('should generate URL for champion by ID', () => {
            const url = leagueChampionIconUrl(1);
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/1.png');
        });

        it('should generate URL for champion by name', () => {
            const url = leagueChampionIconUrl('Aatrox');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/Aatrox.png');
        });

        it('should handle numeric strings', () => {
            const url = leagueChampionIconUrl('266');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/266.png');
        });
    });

    describe('tftUnitIconUrl', () => {
        it('should generate URL for TFT unit', () => {
            const url = tftUnitIconUrl('TFT5_Akshan');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/tft5_akshan/icon.png');
        });

        it('should convert to lowercase', () => {
            const url = tftUnitIconUrl('TFT_Jinx');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/tft_jinx/icon.png');
        });

        it('should handle already lowercase input', () => {
            const url = tftUnitIconUrl('tft6_jayce');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/tft6_jayce/icon.png');
        });
    });

    describe('communityDragonAssetUrl', () => {
        it('should handle asset path with /lol-game-data/assets/ prefix', () => {
            const url = communityDragonAssetUrl('/lol-game-data/assets/items/icons2d/item_1001.png');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/items/icons2d/item_1001.png');
        });

        it('should handle asset path without prefix', () => {
            const url = communityDragonAssetUrl('items/icons2d/item_1001.png');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/items/icons2d/item_1001.png');
        });

        it('should replace backslashes with forward slashes', () => {
            const url = communityDragonAssetUrl('items\\icons2d\\item_1001.png');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/items/icons2d/item_1001.png');
        });

        it('should convert to lowercase', () => {
            const url = communityDragonAssetUrl('/lol-game-data/assets/ITEMS/ICONS2D/Item_1001.PNG');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/items/icons2d/item_1001.png');
        });

        it('should handle multiple backslashes', () => {
            const url = communityDragonAssetUrl('items\\\\icons2d\\\\item_1001.png');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/items/icons2d/item_1001.png');
        });

        it('should handle case-insensitive prefix', () => {
            const url = communityDragonAssetUrl('/LOL-GAME-DATA/ASSETS/items/icons2d/item_1001.png');
            expect(url).toBe('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/items/icons2d/item_1001.png');
        });
    });
});

