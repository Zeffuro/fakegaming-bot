/**
 * Represents a League of Legends item (from items.json).
 * - id: The item's unique identifier.
 * - name: The item's name.
 * - iconPath: The path to the item's icon image.
 */
export interface LeagueItem {
    id: number;
    name: string;
    iconPath: string;
}

/**
 * Represents a League of Legends summoner spell (from summonerspells.json).
 * - id: The spell's unique identifier.
 * - name: The spell's name.
 * - iconPath: The path to the spell's icon image.
 */
export interface LeagueSummonerSpell {
    id: number;
    name: string;
    iconPath: string;
}

/**
 * Represents a League of Legends perk (from perks.json).
 * - id: The perk's unique identifier.
 * - iconPath: The path to the perk's icon image.
 */
export interface LeaguePerk {
    id: number;
    iconPath: string;
}

/**
 * Represents a League of Legends perk style (from perkstyles.json).
 * - id: The perk style's unique identifier.
 * - iconPath: The path to the perk style's icon image.
 */
export interface LeaguePerkStyle {
    id: number;
    iconPath: string;
}

/**
 * Represents a collection of League of Legends perk styles.
 * - styles: An array of perk styles.
 */
export interface LeaguePerkStylesData {
    styles: LeaguePerkStyle[];
}

/**
 * Represents a League of Legends arena augment (from arenaAugments.json).
 * - id: The augment's unique identifier (number or string).
 * - augmentSmallIconPath: The path to the augment's small icon image.
 */
export interface LeagueAugment {
    id: number | string;
    augmentSmallIconPath: string;
}