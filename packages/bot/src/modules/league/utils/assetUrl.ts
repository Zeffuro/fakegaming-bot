const COMMUNITY_DRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';
const COMMUNITY_DRAGON_GAME_BASE = 'https://raw.communitydragon.org/latest/game/';
const LEAGUE_CHAMP_ICON_PATH = 'v1/champion-icons/';

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
    return tftUnitIconUrlCandidates(unitCharacterId)[0];
}

export function tftUnitIconUrlCandidates(unitCharacterId: string): string[] {
    const norm = unitCharacterId.toLowerCase();
    const setMatch = /^tft(?<set>\d+)[a-z]?_/.exec(norm);
    const candidates: string[] = [];

    if (setMatch?.groups?.set) {
        candidates.push(`${COMMUNITY_DRAGON_GAME_BASE}assets/characters/${norm}/hud/${norm}_square.tft_set${setMatch.groups.set}.png`);
    }

    candidates.push(`${COMMUNITY_DRAGON_GAME_BASE}assets/characters/${norm}/hud/${norm}_square.png`);
    candidates.push(`${COMMUNITY_DRAGON_BASE}assets/characters/${norm}/icon.png`);
    return [...new Set(candidates)];
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
