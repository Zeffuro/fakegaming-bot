import {db} from './db.js';
import {QuoteConfig} from '../types/quoteConfig.js';

export class QuoteManager {
    async addQuote(quote: QuoteConfig) {
        db.data!.quotes ||= [];
        db.data!.quotes.push(quote);
        await db.write();
    }

    getQuotes(guildId: string): QuoteConfig[] {
        db.data!.quotes ||= [];
        return db.data!.quotes.filter(quote => quote.guildId === guildId);
    }

    getQuotesByAuthor(guildId: string, authorId: string): QuoteConfig[] {
        db.data!.quotes ||= [];
        return db.data!.quotes.filter(quote => quote.guildId === guildId && quote.authorId === authorId);
    }

    searchQuotes(guildId: string, text: string): QuoteConfig[] {
        db.data!.quotes ||= [];
        const lowerText = text.toLowerCase();
        return db.data!.quotes.filter(quote => quote.guildId === guildId && quote.quote.toLowerCase().includes(lowerText));
    }
}