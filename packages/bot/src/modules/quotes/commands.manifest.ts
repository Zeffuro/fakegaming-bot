// Static metadata for quotes module commands. No runtime deps.

export const addQuote = { name: 'add-quote', description: 'Add a quote' } as const;
export const deleteQuote = { name: 'delete-quote', description: 'Delete a quote you added or authored' } as const;
export const quoteLeaderboard = { name: 'quote-leaderboard', description: 'Show the most quoted users in this server' } as const;
export const quotes = { name: 'quotes', description: 'Get all quotes for a user' } as const;
export const randomQuote = { name: 'random-quote', description: 'Get a random quote from the server' } as const;
export const saveMessageAsQuote = { name: 'Save as Quote', description: 'Save a message as a quote from the message context menu', type: 'message' } as const;
export const searchQuote = { name: 'search-quote', description: 'Search quotes by text' } as const;
export const showQuotes = { name: 'Show Quotes', description: 'Show quotes for a user from the user context menu', type: 'user' } as const;

export const COMMANDS = [addQuote, deleteQuote, quoteLeaderboard, quotes, randomQuote, saveMessageAsQuote, searchQuote, showQuotes] as const;

// Mark as used for type/lint systems
void COMMANDS;
