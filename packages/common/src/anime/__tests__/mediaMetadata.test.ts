import { describe, expect, it } from 'vitest';
import {
    formatAniListCountryOfOrigin,
    formatAniListAutocompleteMeta,
    formatAniListMediaFormat,
    formatAniListPopularity,
    formatAniListRanking,
    formatAniListScore,
    formatAniListStatus,
} from '../mediaMetadata.js';
import { formatAniListSeasonScope } from '../anilistClient.js';

describe('AniList media metadata formatters', () => {
    it('formats manga country-origin names', () => {
        expect(formatAniListMediaFormat({ format: 'MANGA', type: 'MANGA', countryOfOrigin: 'JP' })).toBe('Manga');
        expect(formatAniListMediaFormat({ format: 'MANGA', type: 'MANGA', countryOfOrigin: 'KR' })).toBe('Manhwa');
        expect(formatAniListMediaFormat({ format: 'MANGA', type: 'MANGA', countryOfOrigin: 'CN' })).toBe('Manhua');
        expect(formatAniListMediaFormat({ format: 'MANGA', type: 'MANGA', countryOfOrigin: 'TW' })).toBe('Manhua');
    });

    it('formats origin, scores, popularity, and fallback enum labels', () => {
        expect(formatAniListCountryOfOrigin('KR')).toBe('South Korea');
        expect(formatAniListCountryOfOrigin('US')).toBe('US');
        expect(formatAniListMediaFormat({ format: 'TV_SHORT', type: 'ANIME' })).toBe('TV Short');
        expect(formatAniListMediaFormat({ format: 'ONE_SHOT', type: 'MANGA' })).toBe('One-shot');
        expect(formatAniListScore({ averageScore: 82, meanScore: 79 })).toBe('Average 82/100 - Mean 79/100');
        expect(formatAniListScore({})).toBe('Unknown');
        expect(formatAniListPopularity(1234567)).toBe('1,234,567');
        expect(formatAniListStatus('NOT_YET_RELEASED')).toBe('Not Yet Released');
    });

    it('formats autocomplete and ranking labels without raw enum names', () => {
        expect(formatAniListAutocompleteMeta({
            countryOfOrigin: 'KR',
            format: 'MANGA',
            status: 'FINISHED',
            type: 'MANGA',
        })).toBe('South Korea - Manhwa - Finished');
        expect(formatAniListRanking({ rank: 55, type: 'RATED', allTime: true })).toBe('#55 Highest Rated All Time');
        expect(formatAniListRanking({ rank: 16, type: 'POPULAR', allTime: true })).toBe('#16 Most Popular All Time');
    });

    it('formats Dutch metadata without changing unknown provider values', () => {
        expect(formatAniListStatus('NOT_YET_RELEASED', 'nl')).toBe('Nog niet verschenen');
        expect(formatAniListCountryOfOrigin('KR', 'nl')).toBe('Zuid-Korea');
        expect(formatAniListMediaFormat({ format: 'MOVIE', type: 'ANIME' }, 'nl')).toBe('Film');
        expect(formatAniListMediaFormat({ format: 'NOVEL', type: 'MANGA' }, 'nl')).toBe('Roman');
        expect(formatAniListScore({ averageScore: 84 }, 'nl')).toBe('Gemiddeld 84/100');
        expect(formatAniListPopularity(12345, 'nl')).toBe('12.345');
        expect(formatAniListRanking({ rank: 16, type: 'POPULAR', allTime: true }, 'nl'))
            .toBe('#16 Populairst aller tijden');
        expect(formatAniListStatus('CUSTOM_PROVIDER_STATUS', 'nl')).toBe('Custom Provider Status');
        expect(formatAniListSeasonScope('chart', 'nl')).toBe('seizoensoverzicht');
    });
});
