// Static metadata for notes module commands. No runtime deps.

export const notes = { name: 'notes', description: 'Add, list, show, and delete your personal notes', localizations: { nl: { name: 'notities', description: 'Voeg persoonlijke notities toe, bekijk ze of verwijder ze' } } } as const;
export const saveMessageToNotes = { name: 'Save to Notes', description: 'Save a message excerpt and jump link to your private notes', type: 'message', localizations: { nl: { name: 'Opslaan in notities', description: 'Bewaar een berichtfragment en link in je privénotities' } } } as const;

export const COMMANDS = [notes, saveMessageToNotes] as const;

// Mark as used for type/lint systems
void COMMANDS;
