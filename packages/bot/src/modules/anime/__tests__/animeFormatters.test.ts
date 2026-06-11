import { describe, expect, it } from 'vitest';
import { encodeAniListChoice, parseAniListChoice } from '../shared/anilistAutocomplete.js';
import {
    formatAiringTimestamp,
    formatAnimeStatus,
    formatAnimeTitle,
    stripAniListDescription,
    truncateText,
} from '../shared/animeFormatters.js';

describe('anime formatters', () => {
    it('prefers English title, then romaji/native fallback', () => {
        expect(formatAnimeTitle({
            id: 1,
            title: { english: 'Frieren', romaji: 'Sousou no Frieren', native: '葬送のフリーレン' },
        })).toBe('Frieren');

        expect(formatAnimeTitle({
            id: 2,
            title: { romaji: 'Bocchi the Rock!', native: 'ぼっち・ざ・ろっく!' },
        })).toBe('Bocchi the Rock!');
    });

    it('strips AniList descriptions and normalizes line breaks', () => {
        expect(stripAniListDescription('Line 1<br><b>Line 2</b>\n\n\nLine 3')).toBe('Line 1\nLine 2\n\nLine 3');
    });

    it('formats statuses and timestamps for Discord', () => {
        expect(formatAnimeStatus('NOT_YET_RELEASED')).toBe('Not Yet Released');
        expect(formatAiringTimestamp(1_700_000_000_000)).toBe('<t:1700000000:F> (<t:1700000000:R>)');
    });

    it('truncates text and round-trips AniList autocomplete choices', () => {
        expect(truncateText('abcdef', 5)).toBe('ab...');
        expect(encodeAniListChoice(123)).toBe('anilist:123');
        expect(parseAniListChoice('anilist:123')).toBe(123);
        expect(parseAniListChoice('not-an-id')).toBeNull();
    });
});
