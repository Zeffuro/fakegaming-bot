// Static metadata for twitch module commands. No runtime deps.

export const addTwitchStream = { name: 'add-twitch-stream', description: 'Add a Twitch stream for notifications' } as const;

export const COMMANDS = [addTwitchStream] as const;

// Mark as used for type/lint systems
void COMMANDS;
