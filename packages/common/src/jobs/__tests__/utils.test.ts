import { describe, it, expect } from 'vitest';
import {
    computeExponentialBackoff,
    computeNextDailyRunDelaySeconds,
    computeNextMinuteBoundaryDelaySeconds,
    computeBackoffFromDelay,
    computeBackoffWithNearWindow,
    formatDateKey,
    formatMinuteKey,
} from '../../jobs/index.js';

describe('jobs utils', () => {
    it('computeExponentialBackoff respects base and cap', () => {
        expect(computeExponentialBackoff(1, 60, 900)).toBe(60);
        expect(computeExponentialBackoff(2, 60, 900)).toBe(120);
        expect(computeExponentialBackoff(3, 60, 180)).toBe(180);
        expect(computeExponentialBackoff(10, 60, 180)).toBe(180);
    });

    it('computeNextDailyRunDelaySeconds computes next 09:00 correctly', () => {
        const now = new Date('2025-10-17T08:59:30Z');
        const delay = computeNextDailyRunDelaySeconds(9, now);
        // We cannot assume local TZ; just assert positive and <= 24h
        expect(delay).toBeGreaterThan(0);
        expect(delay).toBeLessThanOrEqual(24 * 60 * 60);
    });

    it('computeNextMinuteBoundaryDelaySeconds computes boundary with min', () => {
        const t = new Date('2025-10-17T09:30:10Z');
        const s = computeNextMinuteBoundaryDelaySeconds(t, 5);
        expect(s).toBeGreaterThanOrEqual(5);
        expect(s).toBeLessThanOrEqual(60);
    });

    it('computeBackoffFromDelay doubles and caps', () => {
        expect(computeBackoffFromDelay(0, 60, 600)).toBe(60);
        expect(computeBackoffFromDelay(59, 60, 600)).toBe(60);
        expect(computeBackoffFromDelay(60, 60, 600)).toBe(120);
        expect(computeBackoffFromDelay(400, 60, 600)).toBe(600);
    });

    it('formatDateKey and formatMinuteKey produce expected shapes', () => {
        const d = new Date('2025-10-17T09:30:45Z');
        const dateKey = formatDateKey(d);
        const minuteKey = formatMinuteKey(d);
        expect(/\d{4}-\d{2}-\d{2}/.test(dateKey)).toBe(true);
        expect(/\d{8}-\d{4}/.test(minuteKey)).toBe(true);
    });
});

describe('jobs utils (near-window backoff)', () => {
    it('computeBackoffWithNearWindow respects near threshold and caps', () => {
        // near: <= 2 * base returns max(base, current)
        expect(computeBackoffWithNearWindow(30, 15, 120, 2)).toBe(30);
        // doubling then cap
        expect(computeBackoffWithNearWindow(50, 10, 60, 2)).toBe(60);
        // below base -> base
        expect(computeBackoffWithNearWindow(5, 10, 60, 2)).toBe(10);
    });
});
