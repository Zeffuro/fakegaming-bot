// Static metadata for youtube module commands. No runtime deps.

export const addYoutubeChannel = { name: 'add-youtube-channel', description: 'Add a Youtube Channel for new video notifications' } as const;

export const COMMANDS = [addYoutubeChannel] as const;

// Mark as used for type/lint systems
void COMMANDS;
