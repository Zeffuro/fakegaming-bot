// Static metadata for youtube module commands. No runtime deps.

export const addYoutubeChannel = { name: 'add-youtube-channel', description: 'Add a Youtube Channel for new video notifications', permissions: 'Administrator' } as const;
export const manageYoutubeChannels = { name: 'manage-youtube-channels', description: 'List or remove YouTube video notifications', permissions: 'Administrator' } as const;
export const youtubeLatest = { name: 'youtube-latest', description: 'Show the latest video from a YouTube channel ID' } as const;

export const COMMANDS = [addYoutubeChannel, manageYoutubeChannels, youtubeLatest] as const;

// Mark as used for type/lint systems
void COMMANDS;
