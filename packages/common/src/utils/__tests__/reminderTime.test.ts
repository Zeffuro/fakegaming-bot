import { describe, expect, it } from 'vitest';
import { parseReminderTime } from '../reminderTime.js';

const now = Date.parse('2026-10-07T10:00:00Z');

describe('parseReminderTime', () => {
    it('resolves relative delays and explicit ISO offsets independently of the host timezone', () => {
        expect(parseReminderTime('10m', 'Europe/Amsterdam', now)?.timestamp).toBe(now + 600_000);
        expect(parseReminderTime('2026-10-08T19:30:00+02:00', 'UTC', now)?.timestamp).toBe(Date.parse('2026-10-08T17:30Z'));
        expect(parseReminderTime('2026-10-08 19:30', 'Europe/Amsterdam', now)?.timestamp).toBe(Date.parse('2026-10-08T17:30Z'));
    });

    it('uses the next occurrence for clock-only input and tomorrow keeps local wall time', () => {
        expect(parseReminderTime('11:00', 'Europe/Amsterdam', now)?.timestamp).toBe(Date.parse('2026-10-08T09:00Z'));
        expect(parseReminderTime('13:00', 'Europe/Amsterdam', now)?.timestamp).toBe(Date.parse('2026-10-07T11:00Z'));
        expect(parseReminderTime('tomorrow', 'Europe/Amsterdam', now)?.timestamp).toBe(now + 86_400_000);
        const beforeDst = Date.parse('2026-10-24T10:00Z');
        expect(parseReminderTime('tomorrow', 'Europe/Amsterdam', beforeDst)?.timestamp).toBe(Date.parse('2026-10-25T11:00Z'));
        expect(parseReminderTime('morgen', 'Europe/Amsterdam', beforeDst)?.timestamp).toBe(Date.parse('2026-10-25T11:00Z'));
    });

    it('rejects missing and ambiguous DST wall times, while explicit offsets disambiguate', () => {
        const early = Date.parse('2026-01-01T00:00Z');
        expect(parseReminderTime('2026-03-29 02:30', 'Europe/Amsterdam', early)).toBeNull();
        expect(parseReminderTime('2026-10-25 02:30', 'Europe/Amsterdam', early)).toBeNull();
        expect(parseReminderTime('2026-10-25T02:30+02:00', 'Europe/Amsterdam', early)?.timestamp).toBe(Date.parse('2026-10-25T00:30Z'));
        expect(parseReminderTime('2026-10-04 02:15', 'Australia/Lord_Howe', early)).toBeNull();
    });

    it.each(['', 'yesterday', '-1h', '0m', '24:00', '2026-02-30 12:00', '2026-02-30T12:00Z', '2026-10-01 10:00', '9999-12-01 10:00', 'x'.repeat(101)])('rejects invalid or past input %s', input => {
        expect(parseReminderTime(input, 'UTC', now)).toBeNull();
    });

    it('rejects unknown timezones and invalid reference times', () => {
        expect(parseReminderTime('1h', 'Not/AZone', now)).toBeNull();
        expect(parseReminderTime('1h', 'UTC', NaN)).toBeNull();
    });
});
