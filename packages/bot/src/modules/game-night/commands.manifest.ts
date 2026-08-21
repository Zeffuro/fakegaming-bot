export const gameNight = { name: 'game-night', description: 'Nominate and vote on games for a server game night', dm_permission: false } as const;

export const COMMANDS = [gameNight] as const;

void COMMANDS;
