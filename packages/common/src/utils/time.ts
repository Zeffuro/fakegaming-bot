import ms from 'ms';

/**
 * Normalize various timestamp representations to milliseconds since epoch.
 * Accepts number, string, bigint, Date, or null/undefined. Returns 0 for invalid inputs.
 */
export function toMillis(v: number | string | bigint | Date | null | undefined): number {
    if (v == null) return 0;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
        const parsed = Date.parse(v);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

/**
 * Safely coerce a date-like value into a Date instance, or undefined when invalid.
 * Handles epoch milliseconds provided as number or string.
 */
export function parseDateSafe(date: string | number | Date | undefined): Date | undefined {
    if (!date) return undefined;
    if (date instanceof Date) return isNaN(date.getTime()) ? undefined : date;
    if (typeof date === 'number') {
        const d = new Date(date);
        return isNaN(d.getTime()) ? undefined : d;
    }
    const asNumber = Number(date);
    if (Number.isFinite(asNumber) && asNumber > 0) {
        const d = new Date(asNumber);
        if (!isNaN(d.getTime())) return d;
    }
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Parse a human timespan like '2h', '30m' to milliseconds. Returns null if invalid.
 */
export function parseTimespan(timespan: string): number | null {
    const result = ms(timespan as unknown as ms.StringValue);
    return typeof result === 'number' && result > 0 ? result : null;
}

/**
 * Format a duration in ms as '<d> days, <h> hrs, <m> mins, <s> secs ago'.
 */
export function formatElapsed(msValue: number): string {
    const secs = Math.floor(msValue / 1000) % 60;
    const mins = Math.floor(msValue / 1000 / 60) % 60;
    const hrs = Math.floor(msValue / 1000 / 60 / 60) % 24;
    const days = Math.floor(msValue / 1000 / 60 / 60 / 24);
    return `${days} day${days !== 1 ? 's' : ''}, ${hrs} hrs, ${mins} mins, ${secs} secs ago`;
}

/**
 * Parse a date-like string into YYYY-MM-DD. Returns undefined if invalid.
 * Accepts ISO strings, yyyy-mm-dd, and natural language dates parsable by Date.
 */
export function parseDateToISO(input: string | Date | number | undefined): string | undefined {
    const date = parseDateSafe(typeof input === 'number' ? input : input as string | Date | undefined);
    if (!date) return undefined;
    const y = date.getUTCFullYear();
    const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const d = `${date.getUTCDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}
