// Static metadata for league module commands. No runtime deps.

export const leagueHistory = { name: 'league-history', description: 'Get recent League of Legends match history for a summoner' } as const;
export const leagueStats = { name: 'league-stats', description: 'Get League of Legends stats for a summoner or linked user' } as const;
export const linkRiot = { name: 'link-riot', description: 'Link your Discord account or another user to a Riot account' } as const;
export const tftHistory = { name: 'tft-history', description: 'Get recent Teamfight Tactics match history for a summoner' } as const;

export const COMMANDS = [leagueHistory, leagueStats, linkRiot, tftHistory] as const;

// Mark as used for type/lint systems
void COMMANDS;
