const COMMUNITY_DRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';
const LEAGUE_CHAMP_ICON_PATH = 'v1/champion-icons/';
const TFT_UNIT_ICON_PATH = 'assets/characters/';

/**
 * Returns the URL for a League champion icon.
 * @param championId The champion's ID or name.
 * @returns The icon URL.
 */
export function leagueChampionIconUrl(championId: number | string): string {
    return `${COMMUNITY_DRAGON_BASE}${LEAGUE_CHAMP_ICON_PATH}${championId}.png`;
}

/**
 * Returns the URL for a TFT unit icon.
 * @param unitCharacterId The unit's character ID.
 * @returns The icon URL.
 */
export function tftUnitIconUrl(unitCharacterId: string): string {
    const norm = unitCharacterId.toLowerCase();
    return `${COMMUNITY_DRAGON_BASE}${TFT_UNIT_ICON_PATH}${norm}/icon.png`;
}

/**
 * Returns the CommunityDragon asset URL for a given asset path.
 * @param assetPath The asset path.
 * @returns The full asset URL.
 */
export function communityDragonAssetUrl(assetPath: string): string {
    let relPath = assetPath.replace(/^\/lol-game-data\/assets\//i, '');
    relPath = relPath.replace(/\\+/g, '/');
    relPath = relPath.toLowerCase();
    return COMMUNITY_DRAGON_BASE + relPath;
}