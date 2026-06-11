// Static metadata for anime module commands. No runtime deps.

export const anime = { name: 'anime', description: 'Search anime, subscribe to releases, and view upcoming episodes' } as const;

export const COMMANDS = [anime] as const;

// Mark as used for type/lint systems
void COMMANDS;
