// Static metadata for reminders module commands. No runtime deps.

export const setReminder = { name: 'set-reminder', description: 'Set a reminder', localizations: { nl: { name: 'herinnering-instellen', description: 'Stel een herinnering in' } } } as const;
export const setTimezone = { name: 'set-timezone', description: 'Set your timezone', localizations: { nl: { name: 'tijdzone-instellen', description: 'Stel je tijdzone in' } } } as const;
export const reminders = { name: 'reminders', description: 'List your active and paused reminders', localizations: { nl: { name: 'herinneringen', description: 'Toon je actieve en gepauzeerde herinneringen' } } } as const;
export const remindMeInOneHour = { name: 'Remind Me in 1h', description: 'Set a one-hour reminder for a message from the message context menu', type: 'message', localizations: { nl: { name: 'Herinner mij over 1u', description: 'Stel via het berichtenmenu een herinnering over één uur in' } } } as const;
export const deleteReminder = { name: 'delete-reminder', description: 'Delete one of your pending reminders', localizations: { nl: { name: 'herinnering-verwijderen', description: 'Verwijder een openstaande herinnering' } } } as const;
export const snoozeReminder = { name: 'snooze-reminder', description: 'Snooze one of your pending reminders', localizations: { nl: { name: 'herinnering-uitstellen', description: 'Stel een openstaande herinnering uit' } } } as const;
export const pauseReminder = { name: 'pause-reminder', description: 'Pause one of your recurring reminders', localizations: { nl: { name: 'herinnering-pauzeren', description: 'Pauzeer een herhalende herinnering' } } } as const;
export const resumeReminder = { name: 'resume-reminder', description: 'Resume one of your recurring reminders', localizations: { nl: { name: 'herinnering-hervatten', description: 'Hervat een herhalende herinnering' } } } as const;

export const COMMANDS = [setReminder, setTimezone, reminders, remindMeInOneHour, deleteReminder, snoozeReminder, pauseReminder, resumeReminder] as const;

// Mark as used for type/lint systems
void COMMANDS;
