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
