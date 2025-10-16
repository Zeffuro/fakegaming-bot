import { describe, it, expect } from 'vitest';
import { toMillis, parseDateSafe, parseTimespan, formatElapsed, parseDateToISO, parseHHmmToMinutes, isWithinQuietHours, formatUptimeShort } from '../utils/time.js';

describe('time utils', () => {
    it('toMillis handles numbers, strings, bigints, dates and invalids', () => {
        expect(toMillis(123)).toBe(123);
        expect(toMillis('456')).toBe(456);
        expect(toMillis('invalid')).toBe(0);
        const d = new Date('2020-01-02T03:04:05Z');
        expect(toMillis(d)).toBe(d.getTime());
        expect(toMillis(10n)).toBe(10);
        expect(toMillis(undefined)).toBe(0);
        expect(toMillis(null)).toBe(0);
    });

    it('parseDateSafe converts inputs to Date or undefined when invalid', () => {
        const d = new Date(1700000000000);
        expect(parseDateSafe(d)?.getTime()).toBe(d.getTime());
        expect(parseDateSafe(1700000000000)?.getUTCFullYear()).toBe(2023);
        expect(parseDateSafe('2020-01-02T00:00:00Z')?.getUTCFullYear()).toBe(2020);
        expect(parseDateSafe('not-a-date')).toBeUndefined();
        expect(parseDateSafe(undefined)).toBeUndefined();
    });

    it('parseTimespan returns ms for valid spans and null for invalid', () => {
        expect(parseTimespan('2h')).toBe(2 * 60 * 60 * 1000);
        expect(parseTimespan('30m')).toBe(30 * 60 * 1000);
        expect(parseTimespan('5s')).toBe(5 * 1000);
        expect(parseTimespan('bogus')).toBeNull();
    });

    it('formatElapsed prints human-readable breakdown', () => {
        const val = ((2 * 24 + 3) * 60 * 60 + (4 * 60) + 5) * 1000; // 2 days, 3 hrs, 4 mins, 5 secs
        expect(formatElapsed(val)).toBe('2 days, 3 hrs, 4 mins, 5 secs ago');
        expect(formatElapsed(1000)).toBe('0 days, 0 hrs, 0 mins, 1 secs ago');
    });

    it('parseDateToISO formats to YYYY-MM-DD or undefined', () => {
        expect(parseDateToISO('2020-01-02T03:04:05Z')).toBe('2020-01-02');
        expect(parseDateToISO(new Date('2021-12-31T23:59:59Z'))).toBe('2021-12-31');
        expect(parseDateToISO('invalid')).toBeUndefined();
        expect(parseDateToISO(undefined)).toBeUndefined();
    });

    it('parseHHmmToMinutes validates format and computes minutes', () => {
        expect(parseHHmmToMinutes('00:00')).toBe(0);
        expect(parseHHmmToMinutes('23:59')).toBe(23 * 60 + 59);
        expect(parseHHmmToMinutes('24:00')).toBeNull();
        expect(parseHHmmToMinutes('07:3x')).toBeNull();
    });

    it('isWithinQuietHours handles same-day and overnight windows', () => {
        const day = new Date('2022-01-01T12:00:00');
        const early = new Date('2022-01-01T06:00:00');
        const late = new Date('2022-01-01T23:00:00');
        expect(isWithinQuietHours('08:00', '20:00', day)).toBe(true);
        expect(isWithinQuietHours('08:00', '20:00', early)).toBe(false);
        expect(isWithinQuietHours('22:00', '07:30', late)).toBe(true);
        expect(isWithinQuietHours('22:00', '07:30', day)).toBe(false);
        expect(isWithinQuietHours(null, null, day)).toBe(false);
        expect(isWithinQuietHours('aa', 'bb', day)).toBe(false);
        // Full-day quiet when equal
        expect(isWithinQuietHours('10:00', '10:00', day)).toBe(true);
    });

    it('formatUptimeShort compacts units correctly', () => {
        expect(formatUptimeShort(2 * 24 * 3600 * 1000 + 3 * 3600 * 1000)).toBe('2d 3h');
        expect(formatUptimeShort(5 * 3600 * 1000 + 12 * 60 * 1000)).toBe('5h 12m');
        expect(formatUptimeShort(42 * 60 * 1000 + 10 * 1000)).toBe('42m 10s');
        expect(formatUptimeShort(8000)).toBe('8s');
    });
});

