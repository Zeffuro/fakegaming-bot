// Static metadata for patchnotes module commands. No runtime deps.

export const getPatchnotes = { name: 'get-patchnotes', description: 'Get the latest patch notes for a game', localizations: { nl: { name: 'patchnotes-ophalen', description: 'Toon de nieuwste patchnotes voor een spel' } } } as const;
export const patchnotesHistory = { name: 'patchnotes-history', description: 'Show stored patch note history for a game', localizations: { nl: { name: 'patchnotes-geschiedenis', description: 'Toon opgeslagen patchnote-geschiedenis voor een spel' } } } as const;
export const subscribePatchnotes = { name: 'subscribe-patchnotes', description: 'Subscribe a channel to patch notes for a game', localizations: { nl: { name: 'patchnotes-abonneren', description: 'Abonneer een kanaal op patchnotes voor een spel' } } } as const;
export const managePatchnotes = { name: 'manage-patchnotes', description: 'List, test, pause, resume, or remove patch note subscriptions', localizations: { nl: { name: 'patchnotes-beheren', description: 'Bekijk, test, pauzeer, hervat of verwijder patchnote-abonnementen' } } } as const;

export const COMMANDS = [getPatchnotes, patchnotesHistory, subscribePatchnotes, managePatchnotes] as const;

// Mark as used for type/lint systems
void COMMANDS;
