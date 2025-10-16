// Static metadata for patchnotes module commands. No runtime deps.

export const getPatchnotes = { name: 'get-patchnotes', description: 'Get the latest patch notes for a game' } as const;
export const subscribePatchnotes = { name: 'subscribe-patchnotes', description: 'Subscribe a channel to patch notes for a game' } as const;

export const COMMANDS = [getPatchnotes, subscribePatchnotes] as const;

// Mark as used for type/lint systems
void COMMANDS;
