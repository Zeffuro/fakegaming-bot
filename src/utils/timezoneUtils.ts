import {timezones} from '../constants/timezones.js';

/**
 * Returns a list of timezones that match the query string (case-insensitive).
 * @param query The search query to filter timezones.
 * @returns An array of matching timezone strings.
 */
export function getTimezoneSuggestions(query: string): string[] {
    const q = query.toLowerCase();
    return timezones.filter((tz: string) => tz.toLowerCase().includes(q));
}

function isGmtOffset(tz: string): boolean {
    const match = /^GMT([+-])(\d{1,2})$/.exec(tz);
    if (!match) return false;
    const offset = parseInt(match[2], 10);
    return offset >= 0 && offset <= 12;
}

/**
 * Checks if the provided timezone string is valid.
 * Accepts standard timezones, 'UTC', 'GMT', and GMT offsets.
 * @param tz The timezone string to validate.
 * @returns True if the timezone is valid, false otherwise.
 */
export function isValidTimezone(tz: string): boolean {
    if (timezones.includes(tz)) return true;

    if (tz === 'UTC' || tz === 'GMT' || isGmtOffset(tz)) return true;

    try {
        Intl.DateTimeFormat(undefined, {timeZone: tz});
        return true;
    } catch {
        return false;
    }
}