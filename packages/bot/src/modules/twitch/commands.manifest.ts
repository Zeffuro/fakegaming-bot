// Static metadata for twitch module commands. No runtime deps.

export const addTwitchStream = { name: 'add-twitch-stream', description: 'Add a Twitch stream for notifications' } as const;
export const streamStatus = { name: 'stream-status', description: 'Check whether a Twitch channel is live' } as const;

export const COMMANDS = [addTwitchStream, streamStatus] as const;

// Mark as used for type/lint systems
void COMMANDS;
