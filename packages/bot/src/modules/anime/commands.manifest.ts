// Static metadata for anime module commands. No runtime deps.

export const anime = { name: 'anime', description: 'Search anime, subscribe to releases, and view upcoming episodes' } as const;
export const manga = { name: 'manga', description: 'Search manga, manhwa, webtoons, and light novels on AniList' } as const;

export const COMMANDS = [anime, manga] as const;

// Mark as used for type/lint systems
void COMMANDS;
