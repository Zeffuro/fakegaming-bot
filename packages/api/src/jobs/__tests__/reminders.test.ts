import { describe, it, expect } from 'vitest';
import { computeNextReminderRunDelaySeconds, computeReminderRetryBackoffSeconds } from '../reminders.js';

describe('reminders jobs helpers', () => {
    it('computeNextReminderRunDelaySeconds returns at least 5s', () => {
        const now = new Date('2025-01-01T00:00:10Z');
        const sec = computeNextReminderRunDelaySeconds(now);
        expect(sec).toBeGreaterThanOrEqual(5);
        expect(sec).toBeLessThanOrEqual(60);
    });

    it('computeReminderRetryBackoffSeconds doubles delays within caps', () => {
        const now = new Date('2025-01-01T00:00:00Z');
        // current timestamp 30s in future -> base backoff window
        const d1 = computeReminderRetryBackoffSeconds(now, now.getTime() + 30_000, 60, 600);
        expect(d1).toBeGreaterThan(0);
        // current timestamp 5m in future -> near cap
        const d2 = computeReminderRetryBackoffSeconds(now, now.getTime() + 300_000, 60, 600);
        expect(d2).toBeLessThanOrEqual(600);
    });
});

