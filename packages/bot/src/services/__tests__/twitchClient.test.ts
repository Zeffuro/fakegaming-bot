import { describe, it, expect } from 'vitest';
import { computeProactiveRefreshDelay } from '../twitchClient.js';

/**
 * Proactive refresh scheduling helper tests
 * - We avoid real timers in tests; the helper computes the delay which the scheduler uses.
 */
describe('twitchClient.computeProactiveRefreshDelay', () => {
    it('returns ~5s when expiry is 2m5s from now (default 2m skew)', () => {
        const now = Date.now();
        const expiry = new Date(now + (2 * 60_000) + 5_000);
        const delay = computeProactiveRefreshDelay(expiry, now);
        expect(delay).toBeGreaterThanOrEqual(4_900);
        expect(delay).toBeLessThanOrEqual(5_100);
    });

    it('returns 0 when expiry is within the skew window', () => {
        const now = Date.now();
        const expiry = new Date(now + 30_000); // 30s remaining < 2m skew
        const delay = computeProactiveRefreshDelay(expiry, now);
        expect(delay).toBe(0);
    });

    it('supports custom skewMs parameter', () => {
        const now = Date.now();
        const expiry = new Date(now + 70_000);
        const delay = computeProactiveRefreshDelay(expiry, now, 60_000); // skew 60s
        // Expect ~10s
        expect(delay).toBeGreaterThanOrEqual(9_900);
        expect(delay).toBeLessThanOrEqual(10_100);
    });
});

