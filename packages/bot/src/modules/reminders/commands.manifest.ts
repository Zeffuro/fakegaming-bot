// Static metadata for reminders module commands. No runtime deps.

export const setReminder = { name: 'set-reminder', description: 'Set a reminder' } as const;
export const setTimezone = { name: 'set-timezone', description: 'Set your timezone' } as const;
export const reminders = { name: 'reminders', description: 'List your active and paused reminders' } as const;
export const remindMeInOneHour = { name: 'Remind Me in 1h', description: 'Set a one-hour reminder for a message from the message context menu', type: 'message' } as const;
export const deleteReminder = { name: 'delete-reminder', description: 'Delete one of your pending reminders' } as const;
export const snoozeReminder = { name: 'snooze-reminder', description: 'Snooze one of your pending reminders' } as const;
export const pauseReminder = { name: 'pause-reminder', description: 'Pause one of your recurring reminders' } as const;
export const resumeReminder = { name: 'resume-reminder', description: 'Resume one of your recurring reminders' } as const;

export const COMMANDS = [setReminder, setTimezone, reminders, remindMeInOneHour, deleteReminder, snoozeReminder, pauseReminder, resumeReminder] as const;

// Mark as used for type/lint systems
void COMMANDS;
