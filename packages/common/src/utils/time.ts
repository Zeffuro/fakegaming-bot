import ms from 'ms';

/**
 * Normalize various timestamp representations to milliseconds since epoch.
 * Accepts number, string, bigint, Date, or null/undefined. Returns 0 for invalid inputs.
 */
export function toMillis(v: number | string | bigint | Date | null | undefined): number {
    if (v == null) return 0;
    if (v instanceof Date) return v.getTime();

    switch (typeof v) {
        case 'number':
            return Number.isFinite(v) ? v : 0;
        case 'bigint':
            return Number(v);
        case 'string': {
            const n = Number(v);
            if (Number.isFinite(n)) return n;
            const parsed = Date.parse(v);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        default:
            return 0;
    }
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
    return result > 0 ? result : null;
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

/**
 * Parse a 24-hour HH:mm string to minutes since midnight (0-1439).
 * Returns null if the input is not a valid HH:mm.
 */
export function parseHHmmToMinutes(hhmm: string): number | null {
    const m = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
    if (!m) return null;
    const hours = Number(m[1]);
    const minutes = Number(m[2]);
    return hours * 60 + minutes;
}

/**
 * Determine if a given time falls within a quiet-hours window.
 * - start and end are strings in HH:mm (24h) local time.
 * - If both are undefined/null or invalid, returns false.
 * - If start === end and valid, returns true (interpreted as full quiet day).
 * - Handles windows that cross midnight (e.g., 22:00–07:30).
 */
export function isWithinQuietHours(
    start: string | null | undefined,
    end: string | null | undefined,
    now: Date
): boolean {
    if (!start || !end) return false;
    const startMin = parseHHmmToMinutes(start);
    const endMin = parseHHmmToMinutes(end);
    if (startMin === null || endMin === null) return false;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    if (startMin === endMin) return true; // full quiet day
    if (startMin < endMin) {
        // same-day window
        return currentMin >= startMin && currentMin < endMin;
    }
    // crosses midnight
    return currentMin >= startMin || currentMin < endMin;
}

/**
 * Format a short human-readable uptime from milliseconds.
 * Examples: 2d 3h; 5h 12m; 42m 10s; 8s
 */
export function formatUptimeShort(msValue: number): string {
    const totalSeconds = Math.max(0, Math.floor(msValue / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}
