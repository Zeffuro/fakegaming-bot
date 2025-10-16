// Static metadata for quotes module commands. No runtime deps.

export const addQuote = { name: 'add-quote', description: 'Add a quote' } as const;
export const quotes = { name: 'quotes', description: 'Get all quotes for a user' } as const;
export const randomQuote = { name: 'random-quote', description: 'Get a random quote from the server' } as const;
export const searchQuote = { name: 'search-quote', description: 'Search quotes by text' } as const;

export const COMMANDS = [addQuote, quotes, randomQuote, searchQuote] as const;

// Mark as used for type/lint systems
void COMMANDS;
