// Static metadata for tiktok module commands. No runtime deps.

export const addTikTokStream = { name: 'add-tiktok-stream', description: 'Add a TikTok account for live notifications' } as const;

export const COMMANDS = [addTikTokStream] as const;

// Mark as used for type/lint systems
void COMMANDS;

