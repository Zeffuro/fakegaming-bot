// Static metadata for notes module commands. No runtime deps.

export const notes = { name: 'notes', description: 'Add, list, show, and delete your personal notes' } as const;
export const saveMessageToNotes = { name: 'Save to Notes', description: 'Save a message excerpt and jump link to your private notes', type: 'message' } as const;

export const COMMANDS = [notes, saveMessageToNotes] as const;

// Mark as used for type/lint systems
void COMMANDS;
