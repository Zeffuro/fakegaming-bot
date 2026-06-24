import { describe, expect, it } from 'vitest';
import {
    buildQuoteOfDayEventId,
    formatQuoteOfDayDateKey,
    selectQuoteOfDay,
    type QuoteOfDayCandidate,
} from '../quoteOfDay.js';

function quote(partial: Partial<QuoteOfDayCandidate>): QuoteOfDayCandidate {
    return {
        id: 'quote-1',
        guildId: 'guild-1',
        quote: 'Quote text',
        authorId: 'author-1',
        submitterId: 'submitter-1',
        timestamp: 1,
        moderationStatus: 'approved',
        ...partial,
    };
}

describe('quote-of-the-day helpers', () => {
    it('selects the same approved quote for the same guild and UTC date', () => {
        const quotes = [
            quote({ id: 'quote-c' }),
            quote({ id: 'quote-a' }),
            quote({ id: 'quote-b' }),
        ];
        const date = new Date('2026-06-24T18:30:00.000Z');

        const first = selectQuoteOfDay(quotes, 'guild-1', date);
        const second = selectQuoteOfDay([...quotes].reverse(), 'guild-1', date);

        expect(first).toEqual(second);
        expect(first.dateKey).toBe('2026-06-24');
        expect(first.eligibleCount).toBe(3);
        expect(first.quote?.guildId).toBe('guild-1');
    });

    it('ignores non-approved quotes and quotes from other guilds', () => {
        const selection = selectQuoteOfDay([
            quote({ id: 'pending', moderationStatus: 'pending' }),
            quote({ id: 'rejected', moderationStatus: 'rejected' }),
            quote({ id: 'other-guild', guildId: 'guild-2' }),
            quote({ id: 'approved' }),
        ], 'guild-1', new Date('2026-06-24T00:00:00.000Z'));

        expect(selection).toMatchObject({
            eligibleCount: 1,
            index: 0,
            quote: expect.objectContaining({ id: 'approved' }),
        });
    });

    it('returns an empty selection when no approved quotes are available', () => {
        expect(selectQuoteOfDay([
            quote({ moderationStatus: 'pending' }),
        ], 'guild-1', new Date('2026-06-24T00:00:00.000Z'))).toEqual({
            dateKey: '2026-06-24',
            quote: null,
            eligibleCount: 0,
            index: null,
        });
    });

    it('formats date keys and notification event ids', () => {
        const date = new Date('2026-06-24T23:59:59.000Z');
        expect(formatQuoteOfDayDateKey(date)).toBe('2026-06-24');
        expect(buildQuoteOfDayEventId('guild-1', date)).toBe('guild-1:2026-06-24');
    });
});
