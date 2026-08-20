// Static metadata for birthdays module commands. No runtime deps.

export const birthday = { name: 'birthday', description: 'Show your or another user\'s birthday', localizations: { nl: { name: 'verjaardag', description: 'Toon de verjaardag van jezelf of een andere gebruiker' } } } as const;
export const birthdays = { name: 'birthdays', description: 'Show upcoming birthdays in this server', localizations: { nl: { name: 'verjaardagen', description: 'Toon komende verjaardagen op deze server' } } } as const;
export const removeBirthday = { name: 'remove-birthday', description: 'Remove your birthday or another user\'s birthday (admins only)', localizations: { nl: { name: 'verjaardag-verwijderen', description: 'Verwijder jouw verjaardag of die van een ander (alleen beheerders)' } } } as const;
export const setBirthday = { name: 'set-birthday', description: 'Set your birthday and the channel to post in', localizations: { nl: { name: 'verjaardag-instellen', description: 'Stel je verjaardag en het kanaal voor meldingen in' } } } as const;
export const showBirthday = { name: 'Show Birthday', description: 'Show a user birthday from the user context menu', type: 'user', localizations: { nl: { name: 'Verjaardag tonen', description: 'Toon een verjaardag via het gebruikersmenu' } } } as const;

export const COMMANDS = [birthday, birthdays, removeBirthday, setBirthday, showBirthday] as const;

// Mark as used for type/lint systems
void COMMANDS;
