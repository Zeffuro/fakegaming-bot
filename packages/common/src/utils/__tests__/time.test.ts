import { describe, it, expect } from 'vitest';
import { parseTimespan, formatElapsed, parseDateToISO, parseDateSafe, toMillis } from '../time.js';
import { parseHHmmToMinutes, isWithinQuietHours } from '../time.js';

describe('utils/time', () => {
    describe('parseTimespan', () => {
        it('parses valid timespan strings', () => {
            expect(parseTimespan('1s')).toBe(1000);
            expect(parseTimespan('1m')).toBe(60000);
            expect(parseTimespan('1h')).toBe(3600000);
            expect(parseTimespan('1d')).toBe(86400000);
            expect(parseTimespan('2h')).toBe(7200000);
            expect(parseTimespan('30m')).toBe(1800000);
        });

        it('returns null for invalid timespan strings', () => {
            expect(parseTimespan('invalid')).toBe(null);
            expect(parseTimespan('-1h')).toBe(null);
        });
    });

    describe('formatElapsed', () => {
        it('formats seconds', () => {
            expect(formatElapsed(5000)).toBe('0 days, 0 hrs, 0 mins, 5 secs ago');
            expect(formatElapsed(1000)).toBe('0 days, 0 hrs, 0 mins, 1 secs ago');
        });

        it('formats minutes', () => {
            expect(formatElapsed(60000)).toBe('0 days, 0 hrs, 1 mins, 0 secs ago');
            expect(formatElapsed(120000)).toBe('0 days, 0 hrs, 2 mins, 0 secs ago');
        });

        it('formats hours', () => {
            expect(formatElapsed(3600000)).toBe('0 days, 1 hrs, 0 mins, 0 secs ago');
            expect(formatElapsed(7200000)).toBe('0 days, 2 hrs, 0 mins, 0 secs ago');
        });

        it('formats days', () => {
            expect(formatElapsed(86400000)).toBe('1 day, 0 hrs, 0 mins, 0 secs ago');
            expect(formatElapsed(172800000)).toBe('2 days, 0 hrs, 0 mins, 0 secs ago');
        });

        it('formats complex durations', () => {
            const ms = 2 * 86400000 + 3 * 3600000 + 15 * 60000 + 30 * 1000;
            expect(formatElapsed(ms)).toBe('2 days, 3 hrs, 15 mins, 30 secs ago');
        });

        it('handles zero', () => {
            expect(formatElapsed(0)).toBe('0 days, 0 hrs, 0 mins, 0 secs ago');
        });
    });

    describe('parseDateToISO', () => {
        it('parses valid date strings to ISO format', () => {
            expect(parseDateToISO('2025-10-08')).toBe('2025-10-08');
            expect(parseDateToISO('2025-01-15')).toBe('2025-01-15');
        });

        it('returns undefined for invalid date strings', () => {
            expect(parseDateToISO('invalid')).toBeUndefined();
            expect(parseDateToISO('')).toBeUndefined();
            expect(parseDateToISO('not a date')).toBeUndefined();
        });

        it('handles date objects created from strings', () => {
            const result = parseDateToISO('2025-10-08T12:00:00Z');
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('parseDateSafe', () => {
        it('handles undefined', () => {
            expect(parseDateSafe(undefined)).toBeUndefined();
        });

        it('handles Date objects', () => {
            const date = new Date('2025-10-08');
            expect(parseDateSafe(date)).toBe(date);
        });

        it('handles timestamps as numbers', () => {
            const timestamp = Date.now();
            const result = parseDateSafe(timestamp);
            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(timestamp);
        });

        it('handles timestamps as strings', () => {
            const timestamp = Date.now();
            const result = parseDateSafe(timestamp.toString());
            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(timestamp);
        });

        it('handles date strings', () => {
            const result = parseDateSafe('2025-10-08');
            expect(result).toBeInstanceOf(Date);
            expect(result?.getFullYear()).toBe(2025);
            expect(result?.getMonth()).toBe(9); // October is month 9
        });

        it('returns undefined for invalid strings', () => {
            expect(parseDateSafe('invalid')).toBeUndefined();
            expect(parseDateSafe('not a date')).toBeUndefined();
        });

        it('handles small numbers as valid epoch ms', () => {
            expect(parseDateSafe(123)).toBeInstanceOf(Date);
        });
    });

    describe('toMillis', () => {
        it('normalizes different input types', () => {
            const now = Date.now();
            expect(toMillis(now)).toBe(now);
            expect(toMillis(String(now))).toBe(now);
            expect(toMillis(new Date(now))).toBe(now);
            expect(toMillis('2025-10-08')).toBeGreaterThan(0);
            expect(toMillis(null)).toBe(0);
            expect(toMillis(undefined)).toBe(0);
        });
    });

    describe('parseHHmmToMinutes', () => {
        it('parses valid HH:mm', () => {
            expect(parseHHmmToMinutes('00:00')).toBe(0);
            expect(parseHHmmToMinutes('07:30')).toBe(450);
            expect(parseHHmmToMinutes('23:59')).toBe(23 * 60 + 59);
        });
        it('returns null for invalid HH:mm', () => {
            expect(parseHHmmToMinutes('24:00')).toBeNull();
            expect(parseHHmmToMinutes('12:60')).toBeNull();
            expect(parseHHmmToMinutes('abc')).toBeNull();
            expect(parseHHmmToMinutes('1:2')).toBeNull();
        });
    });

    describe('isWithinQuietHours', () => {
        it('returns false when start or end is missing', () => {
            const now = new Date('2025-10-10T12:00:00');
            expect(isWithinQuietHours(null, '12:00', now)).toBe(false);
            expect(isWithinQuietHours('12:00', null, now)).toBe(false);
        });
        it('full day quiet when start == end', () => {
            const now = new Date('2025-10-10T12:00:00');
            expect(isWithinQuietHours('00:00', '00:00', now)).toBe(true);
        });
        it('same-day window includes time between start and before end', () => {
            const inside = new Date('2025-10-10T15:00:00');
            const outside = new Date('2025-10-10T11:59:00');
            expect(isWithinQuietHours('12:00', '18:00', inside)).toBe(true);
            expect(isWithinQuietHours('12:00', '18:00', outside)).toBe(false);
        });
        it('cross-midnight window includes late-night and early-morning times', () => {
            const late = new Date('2025-10-10T23:30:00');
            const early = new Date('2025-10-10T06:30:00');
            const midday = new Date('2025-10-10T12:00:00');
            expect(isWithinQuietHours('22:00', '07:00', late)).toBe(true);
            expect(isWithinQuietHours('22:00', '07:00', early)).toBe(true);
            expect(isWithinQuietHours('22:00', '07:00', midday)).toBe(false);
        });
        it('invalid times return false', () => {
            const now = new Date();
            expect(isWithinQuietHours('aa:bb', '07:00', now)).toBe(false);
            expect(isWithinQuietHours('22:00', '77:00', now)).toBe(false);
        });
    });
});
