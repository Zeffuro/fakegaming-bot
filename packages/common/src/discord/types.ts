/**
 * Common Discord-related type definitions
 */

/**
 * Minimal representation of a Discord guild with only essential data
 * Used for caching and permission checking
 */
export interface MinimalGuildData {
    id: string;
    permissions?: string;
    owner?: boolean;
}

export interface DiscordUserProfile {
    id: string;
    username?: string;
    global_name?: string | null;
    discriminator?: string | null;
    avatar?: string | null;
}

export interface DiscordGuildMemberMinimal {
    user?: DiscordUserProfile;
    nick?: string | null;
}
