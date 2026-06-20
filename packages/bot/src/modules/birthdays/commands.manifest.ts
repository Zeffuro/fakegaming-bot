// Static metadata for birthdays module commands. No runtime deps.

export const birthday = { name: 'birthday', description: 'Show your or another user\'s birthday' } as const;
export const birthdays = { name: 'birthdays', description: 'Show upcoming birthdays in this server' } as const;
export const removeBirthday = { name: 'remove-birthday', description: 'Remove your birthday or another user\'s birthday (admins only)' } as const;
export const setBirthday = { name: 'set-birthday', description: 'Set your birthday and the channel to post in' } as const;
export const showBirthday = { name: 'Show Birthday', description: 'Show a user birthday from the user context menu', type: 'user' } as const;

export const COMMANDS = [birthday, birthdays, removeBirthday, setBirthday, showBirthday] as const;

// Mark as used for type/lint systems
void COMMANDS;
