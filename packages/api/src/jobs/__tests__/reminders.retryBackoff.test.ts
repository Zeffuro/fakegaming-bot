import { describe, it, expect } from 'vitest';
import { computeReminderRetryBackoffSeconds } from '../reminders.js';

describe('computeReminderRetryBackoffSeconds', () => {
    it('returns base when current timestamp is due or within base window', () => {
        const now = new Date(2020, 0, 1, 10, 0, 0, 0);
        const dueTs = now.getTime() - 1000;
        expect(computeReminderRetryBackoffSeconds(now, dueTs, 60, 600)).toBe(60);
    });
    it('doubles existing delay up to the cap', () => {
        const now = new Date(2020, 0, 1, 10, 0, 0, 0);
        const tsPlus30 = now.getTime() + 30 * 1000;
        expect(computeReminderRetryBackoffSeconds(now, tsPlus30, 15, 120)).toBe(30); // base->30
        const tsPlus50 = now.getTime() + 50 * 1000;
        expect(computeReminderRetryBackoffSeconds(now, tsPlus50, 10, 60)).toBe(60); // double to 100 -> capped at 60
    });
});

