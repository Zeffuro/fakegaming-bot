// Static metadata for notes module commands. No runtime deps.

export const notes = { name: 'notes', description: 'Add, list, show, and delete your personal notes' } as const;

export const COMMANDS = [notes] as const;

// Mark as used for type/lint systems
void COMMANDS;
