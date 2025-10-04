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
