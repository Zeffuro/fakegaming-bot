// Discord permission constants
export const DISCORD_PERMISSION_ADMINISTRATOR = 0x8;

export function isGuildAdmin(guilds: any[], guildId: string): boolean {
  const guild = guilds.find(g => g.id === guildId);
  if (!guild) return false;

  return guild.owner || (guild.permissions && (parseInt(guild.permissions) & DISCORD_PERMISSION_ADMINISTRATOR));
}
