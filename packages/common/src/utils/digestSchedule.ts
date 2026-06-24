import { parseHHmmToMinutes } from './time.js';

export type DigestFrequency = 'daily' | 'weekly';
export type DigestCategory = 'reminders' | 'anime';

export interface NextDigestRunInput {
    frequency: DigestFrequency;
    timezone: string;
    runAt: string;
    dayOfWeek?: number | null;
    afterTimestamp?: number;
}

export interface DigestScheduleValidationInput {
    frequency: DigestFrequency;
    timezone: string;
    runAt: string;
    dayOfWeek?: number | null;
}

interface LocalDateParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

const dayMs = 24 * 60 * 60 * 1000;
const defaultWeeklyDayOfWeek = 1;

export function normalizeDigestCategories(categories: readonly string[] | null | undefined): DigestCategory[] {
    const normalized = new Set<DigestCategory>();
    for (const category of categories ?? []) {
        if (category === 'reminders') normalized.add(category);
        if (category === 'anime') normalized.add(category);
    }
    return normalized.size > 0 ? [...normalized] : ['reminders'];
}

export function serializeDigestCategories(categories: readonly string[] | null | undefined): string {
    return JSON.stringify(normalizeDigestCategories(categories));
}

export function parseDigestCategories(value: unknown): DigestCategory[] {
    if (Array.isArray(value)) return normalizeDigestCategories(value.filter((item): item is string => typeof item === 'string'));
    if (typeof value !== 'string' || !value.trim()) return ['reminders'];

    try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
            return normalizeDigestCategories(parsed.filter((item): item is string => typeof item === 'string'));
        }
    } catch {
        return ['reminders'];
    }

    return ['reminders'];
}

export function isValidDigestSchedule(input: DigestScheduleValidationInput): boolean {
    return computeNextDigestRunAt({...input, afterTimestamp: 0}) !== null;
}

export function computeNextDigestRunAt(input: NextDigestRunInput): number | null {
    const timezone = normalizeTimezone(input.timezone);
    const runMinutes = parseHHmmToMinutes(input.runAt);
    const afterTimestamp = input.afterTimestamp ?? Date.now();
    if (!timezone || runMinutes === null || !Number.isFinite(afterTimestamp)) return null;

    const targetDayOfWeek = normalizeDayOfWeek(input.frequency, input.dayOfWeek);
    if (targetDayOfWeek === null) return null;

    const currentLocal = getLocalDateParts(afterTimestamp, timezone);
    if (!currentLocal) return null;

    const hour = Math.floor(runMinutes / 60);
    const minute = runMinutes % 60;
    const maxDays = input.frequency === 'weekly' ? 14 : 7;

    for (let offset = 0; offset <= maxDays; offset += 1) {
        const localDate = new Date(Date.UTC(currentLocal.year, currentLocal.month - 1, currentLocal.day + offset));
        if (targetDayOfWeek !== undefined && localDate.getUTCDay() !== targetDayOfWeek) continue;

        const candidate = zonedLocalTimeToUtc(
            {
                year: localDate.getUTCFullYear(),
                month: localDate.getUTCMonth() + 1,
                day: localDate.getUTCDate(),
                hour,
                minute,
                second: 0,
            },
            timezone,
        );
        if (candidate !== null && candidate > afterTimestamp) return candidate;
    }

    return null;
}

function normalizeDayOfWeek(frequency: DigestFrequency, dayOfWeek: number | null | undefined): number | undefined | null {
    if (frequency === 'daily') return undefined;
    const value = dayOfWeek ?? defaultWeeklyDayOfWeek;
    return Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
}

function normalizeTimezone(timezone: string): string | null {
    const trimmed = timezone.trim();
    if (!trimmed) return null;

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).format(new Date(0));
        return trimmed;
    } catch {
        return null;
    }
}

function zonedLocalTimeToUtc(local: LocalDateParts, timezone: string): number | null {
    const localUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, 0);
    let candidate = localUtc - getTimezoneOffsetMs(timezone, localUtc);

    for (let index = 0; index < 3; index += 1) {
        candidate = localUtc - getTimezoneOffsetMs(timezone, candidate);
    }

    const resolved = getLocalDateParts(candidate, timezone);
    if (!resolved) return null;
    if (
        resolved.year !== local.year
        || resolved.month !== local.month
        || resolved.day !== local.day
        || resolved.hour !== local.hour
        || resolved.minute !== local.minute
    ) {
        return null;
    }

    return candidate;
}

function getTimezoneOffsetMs(timezone: string, timestamp: number): number {
    const parts = getLocalDateParts(timestamp, timezone);
    if (!parts) return 0;

    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
    return localAsUtc - Math.floor(timestamp / 1000) * 1000;
}

function getLocalDateParts(timestamp: number, timezone: string): LocalDateParts | null {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        const values = new Map(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
        const year = Number(values.get('year'));
        const month = Number(values.get('month'));
        const day = Number(values.get('day'));
        const hour = Number(values.get('hour'));
        const minute = Number(values.get('minute'));
        const second = Number(values.get('second'));

        if ([year, month, day, hour, minute, second].some((value) => !Number.isFinite(value))) return null;
        return { year, month, day, hour, minute, second };
    } catch {
        return null;
    }
}

export function getDigestWindowMs(frequency: DigestFrequency): number {
    return (frequency === 'weekly' ? 7 : 1) * dayMs;
}
