import {db} from './db.js';
import {Quote} from '../types/quote.js';

export class QuoteManager {
    async addQuote(quote: Quote) {
        db.data!.quotes ||= [];
        db.data!.quotes.push(quote);
        await db.write();
    }

    getQuotes(guildId: string): Quote[] {
        db.data!.quotes ||= [];
        return db.data!.quotes.filter(quote => quote.guildId === guildId);
    }

    getQuotesByAuthor(guildId: string, authorId: string): Quote[] {
        db.data!.quotes ||= [];
        return db.data!.quotes.filter(quote => quote.guildId === guildId && quote.authorId === authorId);
    }

    searchQuotes(guildId: string, text: string): Quote[] {
        db.data!.quotes ||= [];
        const lowerText = text.toLowerCase();
        return db.data!.quotes.filter(quote => quote.guildId === guildId && quote.quote.toLowerCase().includes(lowerText));
    }
}