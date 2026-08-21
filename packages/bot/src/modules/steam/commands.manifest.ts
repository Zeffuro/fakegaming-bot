// Static metadata for steam module commands. No runtime deps.

export const addSteamNews = { name: 'add-steam-news', description: 'Add Steam game news notifications', permissions: 'Administrator' } as const;
export const manageSteamNews = { name: 'manage-steam-news', description: 'List, test, pause, resume, or remove Steam news notifications', permissions: 'Administrator' } as const;

export const COMMANDS = [addSteamNews, manageSteamNews] as const;

// Mark as used for type/lint systems
void COMMANDS;
