/**
 * Utility functions for checking Discord permissions
 */
import { MinimalGuildData } from '../discord/types.js';

/**
 * The Administrator permission flag (0x8)
 */
export const DISCORD_PERMISSION_ADMINISTRATOR = 0x8;

/**
 * Check if a user has admin permissions for a specific guild
 */
export function isGuildAdmin(guilds: MinimalGuildData[] | undefined, guildId: string | undefined): boolean {
    if (!guildId || !Array.isArray(guilds)) {
        return false;
    }

    const guild = guilds.find(g => g.id === guildId);
    if (!guild) return false;

    if (guild.owner === true) return true;

    if (guild.permissions && (parseInt(guild.permissions) & DISCORD_PERMISSION_ADMINISTRATOR) === DISCORD_PERMISSION_ADMINISTRATOR) {
        return true;
    }

    return false;
}

/**
 * Check if a user has admin permissions for a specific guild, with proper error handling
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
