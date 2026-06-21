// Static metadata for bluesky module commands. No runtime deps.

export const addBlueskyAccount = { name: 'add-bluesky-account', description: 'Add a Bluesky account for post notifications', permissions: 'Administrator' } as const;
export const manageBlueskyAccounts = { name: 'manage-bluesky-accounts', description: 'List or remove Bluesky post notifications', permissions: 'Administrator' } as const;

export const COMMANDS = [addBlueskyAccount, manageBlueskyAccounts] as const;

void COMMANDS;
