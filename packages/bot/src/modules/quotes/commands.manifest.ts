// Static metadata for quotes module commands. No runtime deps.

export const addQuote = { name: 'add-quote', description: 'Add a quote', localizations: { nl: { name: 'citaat-toevoegen', description: 'Voeg een citaat toe' } } } as const;
export const deleteQuote = { name: 'delete-quote', description: 'Delete a quote you added or authored', localizations: { nl: { name: 'citaat-verwijderen', description: 'Verwijder een citaat dat je toevoegde of uitsprak' } } } as const;
export const quoteLeaderboard = { name: 'quote-leaderboard', description: 'Show the most quoted users in this server', localizations: { nl: { name: 'citaten-klassement', description: 'Toon de meest geciteerde gebruikers op deze server' } } } as const;
export const quoteCard = { name: 'quote-card', description: 'Render an approved quote as a shareable image', localizations: { nl: { name: 'citaatkaart', description: 'Maak van een goedgekeurd citaat een deelbare afbeelding' } } } as const;
export const quotes = { name: 'quotes', description: 'Get all quotes for a user', localizations: { nl: { name: 'citaten', description: 'Toon alle citaten van een gebruiker' } } } as const;
export const randomQuote = { name: 'random-quote', description: 'Get a random quote from the server', localizations: { nl: { name: 'willekeurig-citaat', description: 'Toon een willekeurig citaat van de server' } } } as const;
export const saveMessageAsQuote = { name: 'Save as Quote', description: 'Save a message as a quote from the message context menu', type: 'message', localizations: { nl: { name: 'Opslaan als citaat', description: 'Bewaar een bericht als citaat via het berichtenmenu' } } } as const;
export const searchQuote = { name: 'search-quote', description: 'Search quotes by text', localizations: { nl: { name: 'citaten-zoeken', description: 'Zoek citaten op tekst' } } } as const;
export const showQuotes = { name: 'Show Quotes', description: 'Show quotes for a user from the user context menu', type: 'user', localizations: { nl: { name: 'Citaten tonen', description: 'Toon citaten via het gebruikersmenu' } } } as const;

export const COMMANDS = [addQuote, deleteQuote, quoteLeaderboard, quoteCard, quotes, randomQuote, saveMessageAsQuote, searchQuote, showQuotes] as const;

// Mark as used for type/lint systems
void COMMANDS;
