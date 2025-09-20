import {BaseManager} from './baseManager.js';
import {QuoteConfig} from '../types/quoteConfig.js';

/**
 * Manages quote records for guilds and authors.
 */
export class QuoteManager extends BaseManager<QuoteConfig> {
    /**
     * Creates a new QuoteManager.
     */
    constructor() {
        super('quotes');
    }

    /**
     * Gets all quotes for a guild.
     * @param guildId The guild's ID.
     * @returns An array of quotes for the guild.
     */
    getQuotes({guildId}: { guildId: string }): QuoteConfig[] {
        return this.collection.filter(quote => quote.guildId === guildId);
    }

    /**
     * Gets all quotes by a specific author in a guild.
     * @param guildId The guild's ID.
     * @param authorId The author's ID.
     * @returns An array of quotes by the author in the guild.
     */
    getQuotesByAuthor({guildId, authorId}: { guildId: string, authorId: string }): QuoteConfig[] {
        return this.collection.filter(quote => quote.guildId === guildId && quote.authorId === authorId);
    }

    /**
     * Searches for quotes containing specific text in a guild.
     * @param guildId The guild's ID.
     * @param text The text to search for.
     * @returns An array of matching quotes.
     */
    searchQuotes({guildId, text}: { guildId: string, text: string }): QuoteConfig[] {
        const lowerText = text.toLowerCase();
        return this.collection.filter(quote => quote.guildId === guildId && quote.quote.toLowerCase().includes(lowerText));
    }
}