const COMMUNITY_DRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';
const LEAGUE_CHAMP_ICON_PATH = 'v1/champion-icons/';
const TFT_UNIT_ICON_PATH = 'assets/characters/';


export function leagueChampionIconUrl(championId: number | string): string {
    return `${COMMUNITY_DRAGON_BASE}${LEAGUE_CHAMP_ICON_PATH}${championId}.png`;
}

export function tftUnitIconUrl(unitCharacterId: string): string {
    const norm = unitCharacterId.toLowerCase();
    return `${COMMUNITY_DRAGON_BASE}${TFT_UNIT_ICON_PATH}${norm}/icon.png`;
}

export function communityDragonAssetUrl(assetPath: string): string {
    let relPath = assetPath.replace(/^\/lol-game-data\/assets\//i, '');
    relPath = relPath.replace(/\\+/g, '/');
    relPath = relPath.toLowerCase();
    return COMMUNITY_DRAGON_BASE + relPath;
}