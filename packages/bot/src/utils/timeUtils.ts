import ms from 'ms';

/**
 * Parses a timespan string (e.g., '2h', '30m') into milliseconds.
 */
export function parseTimespan(timespan: string): number | null {
    const result = ms(timespan as unknown as ms.StringValue);
    return typeof result === 'number' && result > 0 ? result : null;
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 */
export function formatElapsed(ms: number): string {
    const secs = Math.floor(ms / 1000) % 60;
    const mins = Math.floor(ms / 1000 / 60) % 60;
    const hrs = Math.floor(ms / 1000 / 60 / 60) % 24;
    const days = Math.floor(ms / 1000 / 60 / 60 / 24);
    return `${days} day${days !== 1 ? 's' : ''}, ${hrs} hrs, ${mins} mins, ${secs} secs ago`;
}

/**
 * Converts a date string to ISO format ("YYYY-MM-DD").
 */
export function parseDateToISO(dateStr: string): string | undefined {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function parseDateSafe(date: string | number | Date | undefined): Date | undefined {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (typeof date === 'number') return new Date(date);
    // Try to parse string as number first, then as date string
    const asNumber = Number(date);
    if (!isNaN(asNumber) && asNumber > 1000000000000) return new Date(asNumber);
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
}