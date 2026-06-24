import { describe, expect, it } from 'vitest';
import {
    normalizeQuoteTag,
    normalizeQuoteTags,
    parseStoredQuoteTags,
    serializeQuoteTags,
} from '../quoteMetadata.js';

describe('quoteMetadata', () => {
    it('normalizes one quote tag', () => {
        expect(normalizeQuoteTag('  #Raid Night!  ')).toBe('raid-night');
        expect(normalizeQuoteTag(' !!! ')).toBeNull();
    });

    it('normalizes, de-duplicates, and bounds tag lists', () => {
        expect(normalizeQuoteTags([
            'Funny',
            '#funny',
            'Raid Night',
            'very-long-tag-name-that-should-be-truncated-at-the-boundary',
            123,
        ])).toEqual([
            'funny',
            'raid-night',
            'very-long-tag-name-that-should-b',
        ]);
    });

    it('serializes empty tags as null', () => {
        expect(serializeQuoteTags([])).toBeNull();
        expect(serializeQuoteTags(['Fun', 'quote'])).toBe('["fun","quote"]');
    });

    it('parses stored json or legacy delimited text', () => {
        expect(parseStoredQuoteTags('["fun", "Raid Night"]')).toEqual(['fun', 'raid-night']);
        expect(parseStoredQuoteTags('fun, raid-night')).toEqual(['fun', 'raid-night']);
    });
});
