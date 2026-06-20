// Static metadata for general module commands. No runtime deps.

export const help = { name: 'help', description: 'List all available commands and their descriptions.' } as const;
export const calendar = { name: 'calendar', description: 'Show upcoming birthdays and your reminders' } as const;
export const poll = { name: 'poll', description: 'Create a simple poll for users to vote on' } as const;
export const roll = { name: 'roll', description: 'Roll dice or generate a random number' } as const;
export const spin = { name: 'spin', description: 'Spin the wheel to pick someone!' } as const;
export const testNotification = { name: 'test-notification', description: 'Send a sample notification to a channel' } as const;
export const time = { name: 'time', description: 'Convert a time into Discord timestamp formats' } as const;
export const weather = { name: 'weather', description: 'Get the current weather and a short forecast for a specified location' } as const;

export const COMMANDS = [help, calendar, poll, roll, spin, testNotification, time, weather] as const;

// Mark as used for type/lint systems
void COMMANDS;
