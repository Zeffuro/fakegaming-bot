import type { Guild } from 'discord.js';
import { getAppEmojiId } from '../../../core/applicationEmojiManager.js';

/**
 * Canonical emoji names used for tiers. Ensure the target guild has emojis with these names.
 */
export const tierEmojiNames: Record<string, string> = {
    IRON: 'loliron',
    BRONZE: 'lolbronze',
    SILVER: 'lolsilver',
    GOLD: 'lolgold',
    PLATINUM: 'lolplatinum',
    EMERALD: 'lolemerald',
    DIAMOND: 'loldiamond',
    MASTER: 'lolmaster',
    GRANDMASTER: 'lolgrandmaster',
    CHALLENGER: 'lolchallenger',
};

/**
 * Resolve a tier emoji for the current guild by name, or app-level emoji by cached ID.
 * Falls back to empty string if not found.
 *
 * @param guild Guild where the command is executed (can be undefined in DMs)
 * @param tier Riot tier string (e.g., 'GOLD')
 * @returns A formatted emoji mention like "<:name:id>" or an empty string if unavailable
 */
export function getTierEmoji(guild: Guild | null | undefined, tier: string): string {
    const key = tier?.toUpperCase();
    const name = key ? tierEmojiNames[key] : undefined;
    if (!key || !name) return '';

    // 1) Try guild emoji by name
    if (guild) {
        const emoji = guild.emojis.cache.find(e => (e.name?.toLowerCase() ?? '') === name.toLowerCase());
        if (emoji) return `${emoji}`;
    }

    // 2) Try application-level emoji ID from cache
    const id = getAppEmojiId(name);
    if (id) return `<:${name}:${id}>`;

    return '';
}
