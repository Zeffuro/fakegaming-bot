export function getStringQueryParam(query: any, key: string): string | undefined {
    const value = query[key];
    if (typeof value === 'string') return value;
    if (value !== undefined) return String(value);
    return undefined;
}

export function isGuildAdmin(guilds: string[] | undefined, guildId: string | undefined): boolean {
    return !!guildId && Array.isArray(guilds) && guilds.includes(guildId);
}
