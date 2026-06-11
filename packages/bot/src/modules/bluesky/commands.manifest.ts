// Static metadata for bluesky module commands. No runtime deps.

export const addBlueskyAccount = { name: 'add-bluesky-account', description: 'Add a Bluesky account for post notifications' } as const;

export const COMMANDS = [addBlueskyAccount] as const;

void COMMANDS;
