/**
 * Utility functions for checking Discord permissions
 */
import { MinimalGuildData } from '../discord/types.js';

/**
 * The Administrator permission flag in Discord permissions
 * 0x8 = 1000 in binary = Administrator permission
 */
export const DISCORD_PERMISSION_ADMINISTRATOR = 0x8;

/**
 * Check if a user has admin permissions for a specific guild
 * @param guilds List of guilds with their permissions
 * @param guildId Target guild ID
 * @returns boolean indicating if user has admin permissions
 */
export function isGuildAdmin(guilds: MinimalGuildData[] | undefined, guildId: string | undefined): boolean {
    if (!guildId || !Array.isArray(guilds)) {
        return false;
    }

    // Find the guild in the array of guild objects
    const guild = guilds.find(g => g.id === guildId);
    if (!guild) return false;

    // Check if user is the guild owner
    if (guild.owner === true) return true;

    // Check if user has the ADMINISTRATOR permission (0x8)
    if (guild.permissions && (parseInt(guild.permissions) & DISCORD_PERMISSION_ADMINISTRATOR) === DISCORD_PERMISSION_ADMINISTRATOR) {
        return true;
    }

    return false;
}

/**
 * Check if a user has admin permissions for a specific guild, with proper error handling
 * @param guilds List of guilds with their permissions
 * @param guildId Target guild ID
 * @returns Result object with access status and possible error
 */
export function checkGuildAccess(guilds: MinimalGuildData[] | undefined, guildId: string | undefined): {
    hasAccess: boolean;
    error?: string;
    statusCode?: number;
} {
    if (!guildId) {
        return {
            hasAccess: false,
            error: "Missing guild ID",
            statusCode: 400
        };
    }

    if (!Array.isArray(guilds)) {
        return {
            hasAccess: false,
            error: "Guild data unavailable",
            statusCode: 503
        };
    }

    const hasAccess = isGuildAdmin(guilds, guildId);
    if (!hasAccess) {
        return {
            hasAccess: false,
            error: "Not authorized for this guild",
            statusCode: 403
        };
    }

    return { hasAccess: true };
}
