import { describe, expect, it } from 'vitest';
import {
    buildQuoteCurationSummary,
    filterQuotesByModerationStatus,
    filterQuotesForCuration,
    findDuplicateQuoteGroups,
    getRecentQuotes,
    normalizeQuoteForDuplicateReview,
    parseQuoteTagInput,
    type QuoteCurationQuote,
} from '@/lib/quoteCuration';

const quotes: QuoteCurationQuote[] = [
    {
        id: 'quote-1',
        quote: 'First quote about bananas',
        authorId: 'author-1',
        submitterId: 'submitter-1',
        timestamp: 1000,
        tags: ['funny', 'raid-night'],
        source: 'voice chat',
        context: 'Before the pull',
        moderationStatus: 'pending',
    },
    {
        id: 'quote-2',
        quote: 'Second quote about delivery',
        authorId: 'author-2',
        submitterId: 'submitter-1',
        timestamp: 3000,
        tags: ['delivery'],
        source: null,
        context: null,
        moderationStatus: 'approved',
    },
    {
        id: 'quote-3',
        quote: 'Third quote about schedules',
        authorId: 'author-1',
        submitterId: 'submitter-2',
        timestamp: 2000,
        moderationStatus: 'rejected',
    },
];

const userMap = {
    'author-1': { username: 'alpha-user', global_name: 'Alpha' },
    'author-2': { username: 'beta-user', nickname: 'Quote Beta' },
    'submitter-1': { username: 'curator-one', global_name: 'Curator One' },
    'submitter-2': { username: 'curator-two', nickname: 'Second Curator' },
};

describe('quoteCuration', () => {
    it('filters by quote text, author names, submitter names, and ids', () => {
        expect(filterQuotesForCuration(quotes, 'banana', userMap).map((quote) => quote.id)).toEqual(['quote-1']);
        expect(filterQuotesForCuration(quotes, 'quote beta', userMap).map((quote) => quote.id)).toEqual(['quote-2']);
        expect(filterQuotesForCuration(quotes, 'second curator', userMap).map((quote) => quote.id)).toEqual(['quote-3']);
        expect(filterQuotesForCuration(quotes, 'author-1', userMap).map((quote) => quote.id)).toEqual(['quote-1', 'quote-3']);
        expect(filterQuotesForCuration(quotes, 'raid-night', userMap).map((quote) => quote.id)).toEqual(['quote-1']);
        expect(filterQuotesForCuration(quotes, 'voice chat', userMap).map((quote) => quote.id)).toEqual(['quote-1']);
        expect(filterQuotesForCuration(quotes, 'before the pull', userMap).map((quote) => quote.id)).toEqual(['quote-1']);
    });

    it('summarizes authors, submitters, and latest quote', () => {
        const summary = buildQuoteCurationSummary(quotes);

        expect(summary.total).toBe(3);
        expect(summary.uniqueAuthors).toBe(2);
        expect(summary.uniqueSubmitters).toBe(2);
        expect(summary.taggedQuotes).toBe(2);
        expect(summary.pendingQuotes).toBe(1);
        expect(summary.approvedQuotes).toBe(1);
        expect(summary.rejectedQuotes).toBe(1);
        expect(summary.latestQuote?.id).toBe('quote-2');
        expect(summary.topAuthors).toEqual([
            { authorId: 'author-1', count: 2 },
            { authorId: 'author-2', count: 1 },
        ]);
        expect(summary.topTags).toEqual([
            { tag: 'delivery', count: 1 },
            { tag: 'funny', count: 1 },
            { tag: 'raid-night', count: 1 },
        ]);
    });

    it('returns recent quotes in descending timestamp order', () => {
        expect(getRecentQuotes(quotes, 2).map((quote) => quote.id)).toEqual(['quote-2', 'quote-3']);
    });

    it('filters quotes by moderation status', () => {
        expect(filterQuotesByModerationStatus(quotes, 'all').map((quote) => quote.id)).toEqual(['quote-1', 'quote-2', 'quote-3']);
        expect(filterQuotesByModerationStatus(quotes, 'pending').map((quote) => quote.id)).toEqual(['quote-1']);
        expect(filterQuotesByModerationStatus(quotes, 'approved').map((quote) => quote.id)).toEqual(['quote-2']);
        expect(filterQuotesByModerationStatus(quotes, 'rejected').map((quote) => quote.id)).toEqual(['quote-3']);
    });

    it('normalizes quote text for duplicate review', () => {
        expect(normalizeQuoteForDuplicateReview('  Same   QUOTE  ')).toBe('same quote');
    });

    it('parses tag input for curation forms', () => {
        expect(parseQuoteTagInput('Funny, #Raid Night funny')).toEqual(['funny', 'raid', 'night']);
    });

    it('groups duplicate quotes by normalized text and sorts by size', () => {
        const duplicateQuotes: QuoteCurationQuote[] = [
            ...quotes,
            { id: 'quote-4', quote: 'first   quote about BANANAS', authorId: 'author-3', submitterId: 'submitter-2', timestamp: 4000 },
            { id: 'quote-5', quote: 'Second quote about delivery', authorId: 'author-2', submitterId: 'submitter-3', timestamp: 5000 },
            { id: 'quote-6', quote: 'second quote about delivery', authorId: 'author-4', submitterId: 'submitter-3', timestamp: 6000 },
        ];

        const groups = findDuplicateQuoteGroups(duplicateQuotes);

        expect(groups.map((group) => ({
            normalizedQuote: group.normalizedQuote,
            ids: group.quotes.map((quote) => quote.id),
        }))).toEqual([
            { normalizedQuote: 'second quote about delivery', ids: ['quote-6', 'quote-5', 'quote-2'] },
            { normalizedQuote: 'first quote about bananas', ids: ['quote-4', 'quote-1'] },
        ]);
    });
});
