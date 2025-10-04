/**
 * Client-safe constants extracted from common package
 * This prevents server-side modules from being imported in client components
 */

// Discord permission constants
export const DISCORD_PERMISSION_ADMINISTRATOR = 0x8;

/**
 * Checks if a user has admin permissions for a guild
 * This is a client-safe version of the common isGuildAdmin function
 */
export function isGuildAdmin(guilds: any[], guildId: string): boolean {
  const guild = guilds.find(g => g.id === guildId);
  if (!guild) return false;

  return guild.owner || (guild.permissions && (parseInt(guild.permissions) & DISCORD_PERMISSION_ADMINISTRATOR));
}
