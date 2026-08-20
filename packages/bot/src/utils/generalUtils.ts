/**
 * Returns a human-readable string representing the time elapsed since a past timestamp.
 */
export function timeAgo(pastTimestampMs: number, nowTimestampMs?: number, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    const now = nowTimestampMs ?? Date.now();
    const diff = now - pastTimestampMs;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const formatters = {
        en: () => {
            if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
            if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
            if (minutes > 0) return `${minutes} min ago`;
            return 'just now';
        },
        nl: () => {
            if (days > 0) return `${days} dag${days === 1 ? '' : 'en'} geleden`;
            if (hours > 0) return `${hours} uur geleden`;
            if (minutes > 0) return `${minutes} min. geleden`;
            return 'zojuist';
        },
    } satisfies OutputLocaleValues<() => string>;
    return resolveLocaleValue(locale, formatters)();
}

/**
 * Formats a duration in seconds as mm:ss.
 */
export function formatDuration(durationSec: number, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    const min = Math.floor(durationSec / 60);
    const sec = durationSec % 60;
    return resolveLocaleValue(locale, {
        en: `${min}m ${sec.toString().padStart(2, '0')}s`,
        nl: `${min} min. ${sec.toString().padStart(2, '0')} sec.`,
    });
}

/**
 * Cleans up text for Discord by removing tabs, collapsing multiple newlines, and trimming whitespace.
 */
export function cleanDiscordContent(raw: string): string {
    let cleaned = raw.replace(/\t+/g, '');
    cleaned = cleaned.replace(/\n{2,}/g, '\n');
    cleaned = cleaned.trim();
    return cleaned;
}

export function minutes(minutes: number): number {
    return minutes * 60_000;
}

/**
 * Truncates a string to a specified maximum length, appending '...' if truncated.
 */
export function truncateDescription(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    const truncateAt = lastSpace > max * 0.5 ? lastSpace : max - 3;
    return `${cut.slice(0, truncateAt).trim()}...`;
}
import {
    DEFAULT_OUTPUT_LOCALE,
    resolveLocaleValue,
    type OutputLocaleValues,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';
