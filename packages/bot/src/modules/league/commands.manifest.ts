// Static metadata for league module commands. No runtime deps.

export const leagueHistory = { name: 'league-history', description: 'Get recent League of Legends match history by Riot ID or linked user' } as const;
export const leagueStats = { name: 'league-stats', description: 'Get League of Legends stats by Riot ID or linked user' } as const;
export const linkRiot = { name: 'link-riot', description: 'Link your Discord account or another user to a Riot account' } as const;
export const riotLinks = { name: 'riot-links', description: 'Manage linked Riot accounts' } as const;
export const tftHistory = { name: 'tft-history', description: 'Get recent Teamfight Tactics match history by Riot ID or linked user' } as const;
export const tftStats = { name: 'tft-stats', description: 'Get Teamfight Tactics ranked stats by Riot ID or linked user' } as const;

export const COMMANDS = [leagueHistory, leagueStats, linkRiot, riotLinks, tftHistory, tftStats] as const;

// Mark as used for type/lint systems
void COMMANDS;
