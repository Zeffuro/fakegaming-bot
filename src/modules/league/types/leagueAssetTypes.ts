// Minimal type for League items (items.json)
export interface LeagueItem {
    id: number;
    name: string;
    iconPath: string;
}

// Minimal type for Summoner Spells (summonerspells.json)
export interface LeagueSummonerSpell {
    id: number;
    name: string;
    iconPath: string;
}

// Minimal type for Perk (perks.json)
export interface LeaguePerk {
    id: number;
    iconPath: string;
}

// Minimal type for PerkStyle (perkstyles.json)
export interface LeaguePerkStyle {
    id: number;
    iconPath: string;
}

export interface LeaguePerkStylesData {
    styles: LeaguePerkStyle[];
}

// Minimal type for Arena Augment (arenaAugments.json)
export interface LeagueAugment {
    id: number | string;
    augmentSmallIconPath: string;
}