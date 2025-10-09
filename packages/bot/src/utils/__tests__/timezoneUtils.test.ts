import { describe, it, expect } from 'vitest';
import { getTimezoneSuggestions, isValidTimezone } from '../timezoneUtils.js';

describe('timezoneUtils', () => {
    describe('getTimezoneSuggestions', () => {
        it('should return matching timezones (case insensitive)', () => {
            const results = getTimezoneSuggestions('america');
            expect(results.length).toBeGreaterThan(0);
            expect(results.every(tz => tz.toLowerCase().includes('america'))).toBe(true);
        });

        it('should return empty array for no matches', () => {
            const results = getTimezoneSuggestions('zzzzzzz');
            expect(results).toEqual([]);
        });

        it('should handle case insensitive search', () => {
            const lower = getTimezoneSuggestions('pacific');
            const upper = getTimezoneSuggestions('PACIFIC');
            expect(lower).toEqual(upper);
        });

        it('should handle partial matches', () => {
            const results = getTimezoneSuggestions('york');
            expect(results.some(tz => tz.includes('New_York'))).toBe(true);
        });
    });

    describe('isValidTimezone', () => {
        it('should validate standard timezones', () => {
            expect(isValidTimezone('America/New_York')).toBe(true);
            expect(isValidTimezone('Europe/London')).toBe(true);
            expect(isValidTimezone('Asia/Tokyo')).toBe(true);
        });

        it('should validate UTC and GMT', () => {
            expect(isValidTimezone('UTC')).toBe(true);
            expect(isValidTimezone('GMT')).toBe(true);
        });

        it('should validate GMT offsets', () => {
            expect(isValidTimezone('GMT+0')).toBe(true);
            expect(isValidTimezone('GMT+5')).toBe(true);
            expect(isValidTimezone('GMT-8')).toBe(true);
            expect(isValidTimezone('GMT+12')).toBe(true);
        });

        it('should reject invalid GMT offsets', () => {
            expect(isValidTimezone('GMT+13')).toBe(false);
            expect(isValidTimezone('GMT-13')).toBe(false);
            expect(isValidTimezone('GMT+100')).toBe(false);
        });

        it('should reject invalid timezones', () => {
            expect(isValidTimezone('Invalid/Timezone')).toBe(false);
            expect(isValidTimezone('NotATimezone')).toBe(false);
        });

        it('should handle empty strings', () => {
            expect(isValidTimezone('')).toBe(false);
        });
    });
});

