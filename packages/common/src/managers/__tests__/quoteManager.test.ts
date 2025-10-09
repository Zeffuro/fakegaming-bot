import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { QuoteConfig } from '../../models/quote-config.js';

describe('QuoteManager', () => {
    const quoteManager = configManager.quoteManager;

    beforeEach(async () => {
        await quoteManager.removeAll();
    });

    describe('getQuotesByGuild', () => {
        it('should return all quotes for a guild', async () => {
            await QuoteConfig.create({
                id: 'quote-1',
                guildId: 'guild-1',
                authorId: 'author-1',
                quote: 'First quote',
                submitterId: 'quoter-1',
                timestamp: Date.now(),
            });

            await QuoteConfig.create({
                id: 'quote-2',
                guildId: 'guild-1',
                authorId: 'author-2',
                quote: 'Second quote',
                submitterId: 'quoter-2',
                timestamp: Date.now(),
            });

            await QuoteConfig.create({
                id: 'quote-3',
                guildId: 'guild-2',
                authorId: 'author-1',
                quote: 'Third quote',
                submitterId: 'quoter-1',
                timestamp: Date.now(),
            });

            const quotes = await quoteManager.getQuotesByGuild('guild-1');

            expect(quotes).toHaveLength(2);
            expect(quotes.every(q => q.guildId === 'guild-1')).toBe(true);
        });

        it('should return empty array if guild has no quotes', async () => {
            const quotes = await quoteManager.getQuotesByGuild('no-quotes');
            expect(quotes).toEqual([]);
        });
    });

    describe('getQuotesByAuthor', () => {
        it('should return all quotes by an author in a guild', async () => {
            await QuoteConfig.create({
                id: 'quote-4',
                guildId: 'guild-1',
                authorId: 'author-1',
                quote: 'First quote',
                submitterId: 'quoter-1',
                timestamp: Date.now(),
            });

            await QuoteConfig.create({
                id: 'quote-5',
                guildId: 'guild-1',
                authorId: 'author-1',
                quote: 'Second quote',
                submitterId: 'quoter-2',
                timestamp: Date.now(),
            });

            await QuoteConfig.create({
                id: 'quote-6',
                guildId: 'guild-1',
                authorId: 'author-2',
                quote: 'Third quote',
                submitterId: 'quoter-1',
                timestamp: Date.now(),
            });

            const quotes = await quoteManager.getQuotesByAuthor('guild-1', 'author-1');

            expect(quotes).toHaveLength(2);
            expect(quotes.every(q => q.authorId === 'author-1')).toBe(true);
        });
    });

    describe('searchQuotes', () => {
        it('should search quotes by text', async () => {
            await QuoteConfig.create({
                id: 'quote-7',
                guildId: 'guild-1',
                authorId: 'author-1',
                quote: 'The quick brown fox',
                submitterId: 'quoter-1',
                timestamp: Date.now(),
            });

            await QuoteConfig.create({
                id: 'quote-8',
                guildId: 'guild-1',
                authorId: 'author-2',
                quote: 'Jumps over the lazy dog',
                submitterId: 'quoter-2',
                timestamp: Date.now(),
            });

            await QuoteConfig.create({
                id: 'quote-9',
                guildId: 'guild-1',
                authorId: 'author-3',
                quote: 'A fox in the henhouse',
                submitterId: 'quoter-3',
                timestamp: Date.now(),
            });

            const quotes = await quoteManager.searchQuotes('guild-1', 'fox');

            expect(quotes).toHaveLength(2);
            expect(quotes.every(q => q.quote.toLowerCase().includes('fox'))).toBe(true);
        });

        it('should return empty array if no matches found', async () => {
            await QuoteConfig.create({
                id: 'quote-10',
                guildId: 'guild-1',
                authorId: 'author-1',
                quote: 'Test quote',
                submitterId: 'quoter-1',
                timestamp: Date.now(),
            });

            const quotes = await quoteManager.searchQuotes('guild-1', 'nonexistent');

            expect(quotes).toEqual([]);
        });

        it('should be case-insensitive', async () => {
            await QuoteConfig.create({
                id: 'quote-11',
                guildId: 'guild-1',
                authorId: 'author-1',
                quote: 'The QUICK brown FOX',
                submitterId: 'quoter-1',
                timestamp: Date.now(),
            });

            const quotes = await quoteManager.searchQuotes('guild-1', 'quick');

            expect(quotes).toHaveLength(1);
        });
    });
});
