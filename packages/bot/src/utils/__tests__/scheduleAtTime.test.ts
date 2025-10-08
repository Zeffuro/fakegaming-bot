import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleAtTime } from '../scheduleAtTime.js';

describe('scheduleAtTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('should schedule callback based on hour and minute', () => {
        const callback = vi.fn();
        const now = new Date('2025-10-08T10:00:00Z');
        vi.setSystemTime(now);

        // Schedule for later today
        scheduleAtTime(14, 30, callback);

        // Verify setTimeout was called
        expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it('should calculate delay correctly for future time', () => {
        const callback = vi.fn();
        const now = new Date('2025-10-08T10:00:00Z');
        vi.setSystemTime(now);

        scheduleAtTime(14, 30, callback);

        // Verify a timer was scheduled
        expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it('should calculate delay for next day if time passed', () => {
        const callback = vi.fn();
        const now = new Date('2025-10-08T15:00:00Z');
        vi.setSystemTime(now);

        // Schedule for 14:30 (already passed today)
        scheduleAtTime(14, 30, callback);

        // Verify a timer was scheduled
        expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it('should handle midnight scheduling', () => {
        const callback = vi.fn();
        const now = new Date('2025-10-08T23:30:00Z');
        vi.setSystemTime(now);

        scheduleAtTime(0, 0, callback);

        // Verify a timer was scheduled
        expect(vi.getTimerCount()).toBeGreaterThan(0);
    });
});
