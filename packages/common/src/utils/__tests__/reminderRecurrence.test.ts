import { describe, expect, it } from 'vitest';
import {
    formatReminderRecurrence,
    getNextRecurringReminderTimestamp,
    parseReminderRecurrence,
} from '../reminderRecurrence.js';

describe('reminder recurrence helpers', () => {
    it('parses simple recurrence labels with an explicit timezone', () => {
        expect(parseReminderRecurrence('daily', 'Europe/Amsterdam')).toEqual({
            unit: 'day',
            interval: 1,
            timezone: 'Europe/Amsterdam',
        });
        expect(parseReminderRecurrence('every 2 weeks', 'UTC')).toEqual({
            unit: 'week',
            interval: 2,
            timezone: 'UTC',
        });
        expect(parseReminderRecurrence('3mo', 'America/New_York')).toEqual({
            unit: 'month',
            interval: 3,
            timezone: 'America/New_York',
        });
    });

    it('rejects unsupported recurrence text, invalid intervals, and invalid timezones', () => {
        expect(parseReminderRecurrence('weekdays', 'UTC')).toBeNull();
        expect(parseReminderRecurrence('every 0 days', 'UTC')).toBeNull();
        expect(parseReminderRecurrence('every 53 weeks', 'UTC')).toBeNull();
        expect(parseReminderRecurrence('daily', 'Not/AZone')).toBeNull();
    });

    it('calculates the next occurrence after a point in time', () => {
        const rule = parseReminderRecurrence('daily', 'UTC');
        const previousTimestamp = Date.UTC(2026, 0, 1, 9, 30, 0);
        const afterTimestamp = Date.UTC(2026, 0, 3, 10, 0, 0);

        expect(rule).not.toBeNull();
        if (!rule) throw new Error('Expected recurrence rule');
        expect(getNextRecurringReminderTimestamp({
            rule,
            previousTimestamp,
            afterTimestamp,
        })).toBe(Date.UTC(2026, 0, 4, 9, 30, 0));
    });

    it('clamps monthly recurrence to the target month length', () => {
        const rule = parseReminderRecurrence('monthly', 'UTC');
        const previousTimestamp = Date.UTC(2026, 0, 31, 12, 0, 0);

        expect(rule).not.toBeNull();
        if (!rule) throw new Error('Expected recurrence rule');
        expect(getNextRecurringReminderTimestamp({
            rule,
            previousTimestamp,
        })).toBe(Date.UTC(2026, 1, 28, 12, 0, 0));
    });

    it('formats recurrence labels for display', () => {
        expect(formatReminderRecurrence({ unit: 'week', interval: 1, timezone: 'UTC' })).toBe('Every week (UTC)');
        expect(formatReminderRecurrence({ unit: 'day', interval: 3, timezone: 'Europe/Amsterdam' })).toBe('Every 3 days (Europe/Amsterdam)');
    });
});
