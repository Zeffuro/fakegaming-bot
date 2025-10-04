export function getStringQueryParam(query: any, key: string): string | undefined {
    const value = query[key];
    if (typeof value === 'string') return value;
    if (value !== undefined) return String(value);
    return undefined;
}

export function isGuildAdmin(guilds: any[] | undefined, guildId: string | undefined): boolean {
    if (!guildId || !Array.isArray(guilds)) {
        return false;
    }

    // Find the guild in the array of guild objects
    const guild = guilds.find(g => g.id === guildId);

    // Check if user is owner or has admin permissions (0x8)
    return guild ? (guild.owner || (guild.permissions && (parseInt(guild.permissions) & 0x8))) : false;
}
