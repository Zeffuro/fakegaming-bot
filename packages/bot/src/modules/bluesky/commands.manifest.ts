// Static metadata for bluesky module commands. No runtime deps.

export const addBlueskyAccount = { name: 'add-bluesky-account', description: 'Add a Bluesky account for post notifications', permissions: 'Administrator', localizations: { nl: { name: 'bluesky-account-toevoegen', description: 'Voeg een Bluesky-account toe voor berichtmeldingen' } } } as const;
export const manageBlueskyAccounts = { name: 'manage-bluesky-accounts', description: 'List, test, pause, resume, or remove Bluesky post notifications', permissions: 'Administrator', localizations: { nl: { name: 'bluesky-accounts-beheren', description: 'Bekijk, test, pauzeer, hervat of verwijder Bluesky-meldingen' } } } as const;

export const COMMANDS = [addBlueskyAccount, manageBlueskyAccounts] as const;

void COMMANDS;
