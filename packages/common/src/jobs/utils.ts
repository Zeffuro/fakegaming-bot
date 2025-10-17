// Shared helpers for job scheduling and backoff
import type { JobQueue } from './index.js';

/**
 * Compute exponential backoff in seconds given an attempt number (1-based).
 * attempt=1 -> base; doubles each attempt; capped at `cap`.
 */
export function computeExponentialBackoff(attempt: number, base = 60, cap = 15 * 60): number {
    const a = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
    const val = base * Math.pow(2, a - 1);
    return Math.min(cap, val);
}

/**
 * Compute the delay in seconds until the next run at a specific local hour of day.
 * Ensures a minimum delay of 1 second to avoid immediate re-run loops.
 */
export function computeNextDailyRunDelaySeconds(targetHourLocal: number, now: Date = new Date()): number {
    const next = new Date(now.getTime());
    next.setSeconds(0, 0);
    if (now.getHours() >= targetHourLocal) {
        next.setDate(next.getDate() + 1);
    }
    next.setHours(targetHourLocal, 0, 0, 0);
    const diffMs = next.getTime() - now.getTime();
    return Math.max(1, Math.floor(diffMs / 1000));
}

/**
 * Compute the delay in seconds until the next minute boundary.
 * A minimum threshold can be applied to avoid overly aggressive loops.
 */
export function computeNextMinuteBoundaryDelaySeconds(now: Date = new Date(), minSeconds = 0): number {
    const ms = now.getTime();
    const nextMinute = new Date(Math.floor(ms / 60000) * 60000 + 60000);
    const diff = Math.floor((nextMinute.getTime() - ms) / 1000);
    return Math.max(minSeconds, diff);
}

/**
 * Given a current delay (in seconds), compute a doubled exponential backoff capped at `cap`.
 * If current delay is below `base`, return `base`.
 */
export function computeBackoffFromDelay(currentDelaySeconds: number, base = 60, cap = 10 * 60): number {
    const cur = Math.max(0, Math.floor(currentDelaySeconds));
    if (cur < base) return base;
    return Math.min(cap, cur * 2);
}

/**
 * Backoff policy with a configurable "near window":
 * - If currentDelaySeconds <= base * nearMultiplier, return max(base, currentDelaySeconds)
 * - Otherwise, return min(cap, currentDelaySeconds * 2)
 */
export function computeBackoffWithNearWindow(currentDelaySeconds: number, base = 60, cap = 10 * 60, nearMultiplier = 2): number {
    const cur = Math.max(0, Math.floor(currentDelaySeconds));
    const nearThreshold = Math.max(1, Math.floor(base * nearMultiplier));
    if (cur <= nearThreshold) {
        return Math.max(base, cur);
    }
    return Math.min(cap, cur * 2);
}

/**
 * Format a date as YYYY-MM-DD using local time components.
 */
export function formatDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Format a date to a minute-scoped key: YYYYMMDD-HHMM using local time.
 */
export function formatMinuteKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}${m}${day}-${hh}${mm}`;
}

/**
 * Schedule a job with an explicit idempotency key (singleton), returning the provider job id.
 */
export async function scheduleSingleton(queue: JobQueue, name: string, data: unknown, delaySeconds: number, key: string): Promise<string> {
    return queue.schedule(name, data as never, { startAfterSeconds: delaySeconds, idempotencyKey: key });
}
