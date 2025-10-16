// Static metadata for reminders module commands. No runtime deps.

export const setReminder = { name: 'set-reminder', description: 'Set a reminder' } as const;
export const setTimezone = { name: 'set-timezone', description: 'Set your timezone' } as const;

export const COMMANDS = [setReminder, setTimezone] as const;

// Mark as used for type/lint systems
void COMMANDS;
