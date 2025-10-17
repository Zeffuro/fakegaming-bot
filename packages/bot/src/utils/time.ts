/**
 * Compute a proactive refresh delay based on an expiry time.
 * Returns 0 if within the skew window.
 */
export function computeProactiveRefreshDelay(expiry: Date, now: number = Date.now(), skewMs = 2 * 60 * 1000): number {
    const delay = expiry.getTime() - now - skewMs;
    return Math.max(0, delay);
}

export type { };

