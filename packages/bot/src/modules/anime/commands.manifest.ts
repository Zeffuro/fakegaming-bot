// Static metadata for anime module commands. No runtime deps.

export const anime = { name: 'anime', description: 'Search anime, manage subscriptions, and view upcoming episodes', localizations: { nl: { name: 'anime', description: 'Zoek anime, beheer abonnementen en bekijk komende afleveringen' } } } as const;
export const manga = { name: 'manga', description: 'Search manga, manhwa, webtoons, and light novels on AniList', localizations: { nl: { name: 'manga', description: 'Zoek manga, manhwa, webtoons en light novels op AniList' } } } as const;

export const COMMANDS = [anime, manga] as const;

// Mark as used for type/lint systems
void COMMANDS;
