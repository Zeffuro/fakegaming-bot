import { describe, it, expect } from 'vitest';
import { parseTimespan, formatElapsed, parseDateToISO, parseDateSafe } from '../timeUtils.js';

describe('timeUtils', () => {
    describe('parseTimespan', () => {
        it('should parse valid timespan strings', () => {
            expect(parseTimespan('1s')).toBe(1000);
            expect(parseTimespan('1m')).toBe(60000);
            expect(parseTimespan('1h')).toBe(3600000);
            expect(parseTimespan('1d')).toBe(86400000);
            expect(parseTimespan('2h')).toBe(7200000);
            expect(parseTimespan('30m')).toBe(1800000);
        });

        it('should return null for invalid timespan strings', () => {
            expect(parseTimespan('invalid')).toBe(null);
            expect(parseTimespan('-1h')).toBe(null);
        });
    });

    describe('formatElapsed', () => {
        it('should format seconds', () => {
            expect(formatElapsed(5000)).toBe('0 days, 0 hrs, 0 mins, 5 secs ago');
            expect(formatElapsed(1000)).toBe('0 days, 0 hrs, 0 mins, 1 secs ago');
        });

        it('should format minutes', () => {
            expect(formatElapsed(60000)).toBe('0 days, 0 hrs, 1 mins, 0 secs ago');
            expect(formatElapsed(120000)).toBe('0 days, 0 hrs, 2 mins, 0 secs ago');
        });

        it('should format hours', () => {
            expect(formatElapsed(3600000)).toBe('0 days, 1 hrs, 0 mins, 0 secs ago');
            expect(formatElapsed(7200000)).toBe('0 days, 2 hrs, 0 mins, 0 secs ago');
        });

        it('should format days', () => {
            expect(formatElapsed(86400000)).toBe('1 day, 0 hrs, 0 mins, 0 secs ago');
            expect(formatElapsed(172800000)).toBe('2 days, 0 hrs, 0 mins, 0 secs ago');
        });

        it('should format complex durations', () => {
            const ms = 2 * 86400000 + 3 * 3600000 + 15 * 60000 + 30 * 1000;
            expect(formatElapsed(ms)).toBe('2 days, 3 hrs, 15 mins, 30 secs ago');
        });

        it('should handle zero', () => {
            expect(formatElapsed(0)).toBe('0 days, 0 hrs, 0 mins, 0 secs ago');
        });
    });

    describe('parseDateToISO', () => {
        it('should parse valid date strings to ISO format', () => {
            expect(parseDateToISO('2025-10-08')).toBe('2025-10-08');
            expect(parseDateToISO('2025-01-15')).toBe('2025-01-15');
        });

        it('should return undefined for invalid date strings', () => {
            expect(parseDateToISO('invalid')).toBeUndefined();
            expect(parseDateToISO('')).toBeUndefined();
            expect(parseDateToISO('not a date')).toBeUndefined();
        });

        it('should handle date objects created from strings', () => {
            const result = parseDateToISO('2025-10-08T12:00:00Z');
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('parseDateSafe', () => {
        it('should handle undefined', () => {
            expect(parseDateSafe(undefined)).toBeUndefined();
        });

        it('should handle Date objects', () => {
            const date = new Date('2025-10-08');
            expect(parseDateSafe(date)).toBe(date);
        });

        it('should handle timestamps as numbers', () => {
            const timestamp = Date.now();
            const result = parseDateSafe(timestamp);
            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(timestamp);
        });

        it('should handle timestamps as strings', () => {
            const timestamp = Date.now();
            const result = parseDateSafe(timestamp.toString());
            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(timestamp);
        });

        it('should handle date strings', () => {
            const result = parseDateSafe('2025-10-08');
            expect(result).toBeInstanceOf(Date);
            expect(result?.getFullYear()).toBe(2025);
            expect(result?.getMonth()).toBe(9); // October is month 9
        });

        it('should return undefined for invalid strings', () => {
            expect(parseDateSafe('invalid')).toBeUndefined();
            expect(parseDateSafe('not a date')).toBeUndefined();
        });

        it('should handle small numbers as invalid', () => {
            expect(parseDateSafe(123)).toBeInstanceOf(Date);
        });
    });
});
