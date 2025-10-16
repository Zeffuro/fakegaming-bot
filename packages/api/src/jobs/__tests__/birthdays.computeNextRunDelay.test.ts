import { describe, it, expect } from 'vitest';
import { computeNextRunDelaySeconds } from '../birthdays.js';

function makeLocalDate(hours: number, minutes = 0, seconds = 0, ms = 0): Date {
    const d = new Date(2020, 0, 1, hours, minutes, seconds, ms);
    return d;
}

describe('computeNextRunDelaySeconds', () => {
    it('returns seconds until next 09:00 when before 09:00', () => {
        const now = makeLocalDate(8, 30, 0, 0); // 08:30 local time
        const delay = computeNextRunDelaySeconds(now);
        expect(delay).toBe(30 * 60);
    });

    it('schedules next day 09:00 when at or after 09:00', () => {
        const now = makeLocalDate(9, 1, 0, 0); // 09:01 local time
        const expectedNext = makeLocalDate(9, 0, 0, 0);
        expectedNext.setDate(expectedNext.getDate() + 1);
        const expectedSeconds = Math.floor((expectedNext.getTime() - now.getTime()) / 1000);
        const delay = computeNextRunDelaySeconds(now);
        expect(delay).toBe(expectedSeconds);
    });
});

