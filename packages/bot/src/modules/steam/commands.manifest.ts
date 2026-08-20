// Static metadata for steam module commands. No runtime deps.

export const addSteamNews = { name: 'add-steam-news', description: 'Add Steam game news notifications', permissions: 'Administrator', localizations: { nl: { name: 'steamnieuws-toevoegen', description: 'Voeg meldingen voor Steam-spelnieuws toe' } } } as const;
export const manageSteamNews = { name: 'manage-steam-news', description: 'List, test, pause, resume, or remove Steam news notifications', permissions: 'Administrator', localizations: { nl: { name: 'steamnieuws-beheren', description: 'Bekijk, test, pauzeer, hervat of verwijder Steamnieuwsmeldingen' } } } as const;

export const COMMANDS = [addSteamNews, manageSteamNews] as const;

// Mark as used for type/lint systems
void COMMANDS;
