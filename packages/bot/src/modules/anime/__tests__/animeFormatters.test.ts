import {describe, expect, it} from 'vitest';
import {encodeAniListChoice, parseAniListChoice} from '../shared/anilistAutocomplete.js';
import {
    formatAiringTimestamp,
    formatAnimeStatus,
    formatAnimeTitle,
    formatGenres,
    stripAniListDescription,
    truncateText,
} from '../shared/animeFormatters.js';

describe('anime formatters', () => {
    it('prefers English title, then romaji/native fallback', () => {
        expect(formatAnimeTitle({
            id: 1,
            title: {english: 'Frieren', romaji: 'Sousou no Frieren', native: 'Native Frieren'},
        })).toBe('Frieren');

        expect(formatAnimeTitle({
            id: 2,
            title: {romaji: 'Bocchi the Rock!', native: 'Native Bocchi'},
        })).toBe('Bocchi the Rock!');

        expect(formatAnimeTitle({
            id: 3,
            title: {native: 'Native Title'},
        })).toBe('Native Title');

        expect(formatAnimeTitle({
            id: 4,
            title: {},
        })).toBe('Unknown anime');
    });

    it('formats stored anime titles with fallbacks', () => {
        expect(formatAnimeTitle({
            anilistId: 10,
            titleEnglish: 'English',
            titleRomaji: 'Romaji',
            titleNative: 'Native',
        })).toBe('English');
        expect(formatAnimeTitle({
            anilistId: 11,
            titleRomaji: 'Romaji',
            titleNative: 'Native',
        })).toBe('Romaji');
        expect(formatAnimeTitle({
            anilistId: 12,
            titleNative: 'Native',
        })).toBe('Native');
        expect(formatAnimeTitle({
            anilistId: 13,
        })).toBe('AniList #13');
    });

    it('strips AniList descriptions and normalizes line breaks', () => {
        expect(stripAniListDescription('Line 1<br><b>Line 2</b>\n\n\nLine 3')).toBe('Line 1\nLine 2\n\nLine 3');
        expect(stripAniListDescription(null)).toBe('No description available.');
    });

    it('formats statuses, timestamps, and genres for Discord', () => {
        expect(formatAnimeStatus('NOT_YET_RELEASED')).toBe('Not Yet Released');
        expect(formatAnimeStatus(null)).toBe('Unknown');
        expect(formatAiringTimestamp(1_700_000_000_000)).toBe('<t:1700000000:F> (<t:1700000000:R>)');
        expect(formatAiringTimestamp(null)).toBe('Unknown');
        expect(formatGenres(['Action', 'Comedy', 'Drama', 'Fantasy', 'Slice of Life', 'Sci-Fi', 'Mystery'])).toBe('Action, Comedy, Drama, Fantasy, Slice of Life, Sci-Fi');
        expect(formatGenres([])).toBe('Unknown');
    });

    it('truncates text and round-trips AniList autocomplete choices', () => {
        expect(truncateText('short', 10)).toBe('short');
        expect(truncateText('abcdef', 5)).toBe('ab...');
        expect(truncateText('abcdef', 2)).toBe('...');
        expect(encodeAniListChoice(123)).toBe('anilist:123');
        expect(parseAniListChoice('anilist:123')).toBe(123);
        expect(parseAniListChoice('not-an-id')).toBeNull();
    });
});
