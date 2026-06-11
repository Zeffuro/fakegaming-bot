// Static metadata for reminders module commands. No runtime deps.

export const setReminder = { name: 'set-reminder', description: 'Set a reminder' } as const;
export const setTimezone = { name: 'set-timezone', description: 'Set your timezone' } as const;
export const reminders = { name: 'reminders', description: 'List your pending reminders' } as const;
export const deleteReminder = { name: 'delete-reminder', description: 'Delete one of your pending reminders' } as const;
export const snoozeReminder = { name: 'snooze-reminder', description: 'Snooze one of your pending reminders' } as const;

export const COMMANDS = [setReminder, setTimezone, reminders, deleteReminder, snoozeReminder] as const;

// Mark as used for type/lint systems
void COMMANDS;
