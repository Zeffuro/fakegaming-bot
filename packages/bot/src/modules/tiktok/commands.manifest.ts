// Static metadata for tiktok module commands. No runtime deps.

export const addTikTokStream = { name: 'add-tiktok-stream', description: 'Add a TikTok account for live notifications', permissions: 'Administrator' } as const;
export const manageTikTokStreams = { name: 'manage-tiktok-streams', description: 'List or remove TikTok live notifications', permissions: 'Administrator' } as const;

export const COMMANDS = [addTikTokStream, manageTikTokStreams] as const;

// Mark as used for type/lint systems
void COMMANDS;

