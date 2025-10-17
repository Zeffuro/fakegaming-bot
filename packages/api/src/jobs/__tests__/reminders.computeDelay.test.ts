import { describe, it, expect } from 'vitest';
import { computeNextReminderRunDelaySeconds } from '../reminders.js';

function mkDate(h: number, m: number, s: number, ms = 0): Date {
    return new Date(2020, 0, 1, h, m, s, ms);
}

describe('computeNextReminderRunDelaySeconds', () => {
    it('waits until the start of next minute', () => {
        const now = mkDate(10, 15, 30, 0); // 10:15:30.000
        const delay = computeNextReminderRunDelaySeconds(now);
        expect(delay).toBe(30); // to 10:16:00
    });

    it('enforces a minimum delay of 5 seconds', () => {
        const now = mkDate(10, 15, 59, 800); // 200ms until next minute
        const delay = computeNextReminderRunDelaySeconds(now);
        expect(delay).toBe(5);
    });
});

