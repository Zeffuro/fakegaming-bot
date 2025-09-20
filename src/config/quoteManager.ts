import {BaseManager} from './baseManager.js';
import {QuoteConfig} from '../types/quoteConfig.js';

export class QuoteManager extends BaseManager<QuoteConfig> {
    constructor() {
        super('quotes');
    }

    getQuotes({guildId}: { guildId: string }): QuoteConfig[] {
        return this.collection.filter(quote => quote.guildId === guildId);
    }

    getQuotesByAuthor({guildId, authorId}: { guildId: string, authorId: string }): QuoteConfig[] {
        return this.collection.filter(quote => quote.guildId === guildId && quote.authorId === authorId);
    }

    searchQuotes({guildId, text}: { guildId: string, text: string }): QuoteConfig[] {
        const lowerText = text.toLowerCase();
        return this.collection.filter(quote => quote.guildId === guildId && quote.quote.toLowerCase().includes(lowerText));
    }
}