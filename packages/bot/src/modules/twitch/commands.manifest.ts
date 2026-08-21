// Static metadata for twitch module commands. No runtime deps.

export const addTwitchStream = { name: 'add-twitch-stream', description: 'Add a Twitch stream for notifications', permissions: 'Administrator' } as const;
export const manageTwitchStreams = { name: 'manage-twitch-streams', description: 'List, test, pause, resume, or remove Twitch stream notifications', permissions: 'Administrator' } as const;
export const streamStatus = { name: 'stream-status', description: 'Check whether a Twitch channel is live' } as const;
export const twitchLatestVod = { name: 'twitch-latest-vod', description: 'Show the latest Twitch archive VOD for a channel' } as const;

export const COMMANDS = [addTwitchStream, manageTwitchStreams, streamStatus, twitchLatestVod] as const;

// Mark as used for type/lint systems
void COMMANDS;
