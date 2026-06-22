import {describe, expect, it} from 'vitest';
import {formatRiotId, parseRiotId} from '../riotId.js';

describe('riotId utilities', () => {
    it('parses Riot IDs with a tag line', () => {
        expect(parseRiotId(' Zeffuro # EUW ')).toEqual({
            gameName: 'Zeffuro',
            tagLine: 'EUW',
        });
    });

    it('keeps legacy name-only values parseable', () => {
        expect(parseRiotId('LegacySummoner')).toEqual({
            gameName: 'LegacySummoner',
            tagLine: null,
        });
        expect(parseRiotId('')).toBeNull();
    });

    it('formats separate fields with fallback compatibility', () => {
        expect(formatRiotId('Zeffuro', 'EUW', 'Legacy')).toBe('Zeffuro#EUW');
        expect(formatRiotId('LegacySummoner', null)).toBe('LegacySummoner');
        expect(formatRiotId(null, null, 'Fallback#NA1')).toBe('Fallback#NA1');
    });
});
