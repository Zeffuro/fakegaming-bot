export const gameNight = { name: 'game-night', description: 'Nominate and vote on games for a server game night', dm_permission: false, localizations: { nl: { name: 'spelavond', description: 'Nomineer en stem op spellen voor een spelavond van de server' } } } as const;

export const COMMANDS = [gameNight] as const;

void COMMANDS;
