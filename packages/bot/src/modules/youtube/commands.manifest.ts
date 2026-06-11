// Static metadata for youtube module commands. No runtime deps.

export const addYoutubeChannel = { name: 'add-youtube-channel', description: 'Add a Youtube Channel for new video notifications' } as const;
export const youtubeLatest = { name: 'youtube-latest', description: 'Show the latest video from a YouTube channel ID' } as const;

export const COMMANDS = [addYoutubeChannel, youtubeLatest] as const;

// Mark as used for type/lint systems
void COMMANDS;
