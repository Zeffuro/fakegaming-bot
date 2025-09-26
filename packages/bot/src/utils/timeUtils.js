import ms from 'ms';
/**
 * Parses a timespan string (e.g., '2h', '30m') into milliseconds.
 * @param timespan The timespan string to parse.
 * @returns The number of milliseconds, or null if invalid.
 */
export function parseTimespan(timespan) {
    const result = ms(timespan);
    return typeof result === 'number' && result > 0 ? result : null;
}
/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param ms The duration in milliseconds.
 * @returns A formatted string representing the elapsed time.
 */
export function formatElapsed(ms) {
    const secs = Math.floor(ms / 1000) % 60;
    const mins = Math.floor(ms / 1000 / 60) % 60;
    const hrs = Math.floor(ms / 1000 / 60 / 60) % 24;
    const days = Math.floor(ms / 1000 / 60 / 60 / 24);
    return `${days} day${days !== 1 ? 's' : ''}, ${hrs} hrs, ${mins} mins, ${secs} secs ago`;
}
/**
 * Converts a date string (e.g., "September 16, 2025") to ISO format ("YYYY-MM-DD").
 * Useful for normalizing patch note dates for version comparison.
 * @param dateStr - The date string to convert.
 * @returns The ISO date string ("YYYY-MM-DD"), or `undefined` if parsing fails.
 */
export function parseDateToISO(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime()))
        return undefined;
    return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
export function parseDateSafe(date) {
    if (!date)
        return undefined;
    if (date instanceof Date)
        return date;
    if (typeof date === 'number')
        return new Date(date);
    // Try to parse string as number first, then as date string
    const asNumber = Number(date);
    if (!isNaN(asNumber) && asNumber > 1000000000000)
        return new Date(asNumber);
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
}
