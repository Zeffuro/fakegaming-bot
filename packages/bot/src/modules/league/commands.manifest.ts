// Static metadata for league module commands. No runtime deps.

export const leagueHistory = { name: 'league-history', description: 'Get recent League of Legends match history by Riot ID or linked user', localizations: { nl: { name: 'league-geschiedenis', description: 'Toon recente League of Legends-wedstrijden via Riot ID of gekoppelde gebruiker' } } } as const;
export const leagueForm = { name: 'league-form', description: 'Summarize recent League of Legends form by Riot ID or linked user', localizations: { nl: { name: 'league-vorm', description: 'Vat recente League of Legends-vorm samen via Riot ID of gekoppelde gebruiker' } } } as const;
export const leagueStats = { name: 'league-stats', description: 'Get League of Legends stats by Riot ID or linked user', localizations: { nl: { name: 'league-statistieken', description: 'Toon League of Legends-statistieken via Riot ID of gekoppelde gebruiker' } } } as const;
export const linkRiot = { name: 'link-riot', description: 'Link your Discord account or another user to a Riot account', localizations: { nl: { name: 'riot-koppelen', description: 'Koppel jouw Discord-account of een andere gebruiker aan een Riot-account' } } } as const;
export const riotLinks = { name: 'riot-links', description: 'Manage linked Riot accounts', localizations: { nl: { name: 'riot-koppelingen', description: 'Beheer gekoppelde Riot-accounts' } } } as const;
export const tftHistory = { name: 'tft-history', description: 'Get recent Teamfight Tactics match history by Riot ID or linked user', localizations: { nl: { name: 'tft-geschiedenis', description: 'Toon recente TFT-wedstrijden via Riot ID of gekoppelde gebruiker' } } } as const;
export const tftStats = { name: 'tft-stats', description: 'Get Teamfight Tactics ranked stats by Riot ID or linked user', localizations: { nl: { name: 'tft-statistieken', description: 'Toon TFT-rangstatistieken via Riot ID of gekoppelde gebruiker' } } } as const;

export const COMMANDS = [leagueHistory, leagueForm, leagueStats, linkRiot, riotLinks, tftHistory, tftStats] as const;

// Mark as used for type/lint systems
void COMMANDS;
