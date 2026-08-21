// Static metadata for general module commands. No runtime deps.

export const help = { name: 'help', description: 'List all available commands and their descriptions.', localizations: { nl: { name: 'help', description: 'Toon alle beschikbare opdrachten en hun beschrijvingen' } } } as const;
export const calendar = { name: 'calendar', description: 'Show upcoming birthdays and your reminders', localizations: { nl: { name: 'kalender', description: 'Toon komende verjaardagen en je herinneringen' } } } as const;
export const poll = { name: 'poll', description: 'Create a button poll with live results', localizations: { nl: { name: 'peiling', description: 'Maak een peiling met knoppen en live resultaten' } } } as const;
export const question = { name: 'question', description: 'Draw a conversation question from a local deck', localizations: { nl: { name: 'vraag', description: 'Trek een gespreksvraag uit een lokaal kaartspel' } } } as const;
export const permissionsBackup = { name: 'permissions-backup', description: 'Save and export role, category, and channel permissions', permissions: 'Administrator', default_member_permissions: '8', localizations: { nl: { name: 'rechten-back-up', description: 'Bewaar en exporteer rol-, categorie- en kanaalrechten' } } } as const;
export const occupyChannel = { name: 'occupy-channel', description: 'Keep a voice channel occupied while the bot is online', permissions: 'Administrator', dm_permission: false, default_member_permissions: '8', localizations: { nl: { name: 'kanaal-bezetten', description: 'Houd een spraakkanaal bezet zolang de bot online is' } } } as const;
export const profileCard = { name: 'profile-card', description: 'Render a Discord profile card', localizations: { nl: { name: 'profielkaart', description: 'Maak een Discord-profielkaart' } } } as const;
export const roll = { name: 'roll', description: 'Roll dice or generate a random number', localizations: { nl: { name: 'werpen', description: 'Werp dobbelstenen of maak een willekeurig getal' } } } as const;
export const spin = { name: 'spin', description: 'Spin the wheel to pick someone!', localizations: { nl: { name: 'draaien', description: 'Draai aan het rad om iemand te kiezen' } } } as const;
export const testNotification = { name: 'test-notification', description: 'Send a sample notification to a channel', localizations: { nl: { name: 'testmelding', description: 'Stuur een testmelding naar een kanaal' } } } as const;
export const time = { name: 'time', description: 'Convert a time into Discord timestamp formats', localizations: { nl: { name: 'tijd', description: 'Zet een tijd om naar Discord-tijdstempelindelingen' } } } as const;
export const weather = { name: 'weather', description: 'Get the current weather and a short forecast for a specified location', localizations: { nl: { name: 'weer', description: 'Toon het huidige weer en een korte verwachting voor een locatie' } } } as const;

export const COMMANDS = [help, calendar, poll, question, permissionsBackup, occupyChannel, profileCard, roll, spin, testNotification, time, weather] as const;

// Mark as used for type/lint systems
void COMMANDS;
