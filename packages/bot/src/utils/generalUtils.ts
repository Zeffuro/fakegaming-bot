/**
 * Returns a human-readable string representing the time elapsed since a past timestamp.
 * @param pastTimestampMs The past timestamp in milliseconds.
 * @param nowTimestampMs The current timestamp in milliseconds (optional).
 * @returns A formatted string like '2 days ago', 'just now', etc.
 */
export function timeAgo(pastTimestampMs: number, nowTimestampMs?: number): string {
    const now = nowTimestampMs ?? Date.now();
    const diff = now - pastTimestampMs;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} min ago`;
    return 'just now';
}

/**
 * Formats a duration in seconds as a string in mm:ss format.
 * @param durationSec The duration in seconds.
 * @returns The formatted duration string.
 */
export function formatDuration(durationSec: number): string {
    const min = Math.floor(durationSec / 60);
    const sec = durationSec % 60;
    return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

/**
 * Cleans up text for Discord by removing tabs, collapsing multiple newlines, and trimming whitespace.
 * Useful for formatting patch notes or other content before saving or sending.
 * @param raw - The raw string to clean.
 * @returns The cleaned string, ready for Discord or database storage.
 */
export function cleanDiscordContent(raw: string): string {
    let cleaned = raw.replace(/\t+/g, '');
    cleaned = cleaned.replace(/\n{2,}/g, '\n');
    cleaned = cleaned.trim();
    return cleaned;
}

/**
 * Converts minutes to milliseconds.
 * Useful for scheduling intervals in a readable way.
 * @param {number} minutes - The number of minutes.
 * @returns {number} The equivalent milliseconds.
 */
export function minutes(minutes: number): number {
    return minutes * 60_000;
}

/**
 * Truncates a string to a specified maximum length, appending '...' if truncated.
 * @param {string} text - The input string to truncate.
 * @param {number} max - The maximum allowed length of the string.
 * @returns {string} The truncated string, with '...' appended if truncation occurred.
 */
export function truncateDescription(text: string, max: number): string {
    if (text.length <= max) return text;
    // Find the last space before max, fallback to max-3 if none found
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    const truncateAt = lastSpace > max * 0.5 ? lastSpace : max - 3;
    return `${cut.slice(0, truncateAt).trim()}...`;
}