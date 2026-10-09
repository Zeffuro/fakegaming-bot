import { parseTimespan } from './time.js';

export interface ReminderTime {
    timestamp: number;
    timespan: string;
}

interface WallTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

const DAY_MS = 86_400_000;
const MAX_DELAY_MS = 3660 * DAY_MS;

export function parseReminderTime(input: string, timezone: string, now = Date.now()): ReminderTime | null {
    const value = input.trim();
    if (!value || value.length > 100 || !Number.isFinite(now)) return null;
    let formatter: Intl.DateTimeFormat;
    try {
        formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
        });
    } catch {
        return null;
    }
    let timestamp: number | null = null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/i.exec(value);
    if (iso) {
        const wall = partsFromMatch(iso);
        if (!validWallTime(wall)) return null;
        timestamp = Date.parse(value);
    } else {
        const date = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
        const clock = /^(\d{1,2}):(\d{2})$/.exec(value);
        if (date) {
            timestamp = resolveWallTime(partsFromMatch(date), formatter);
        } else if (clock || /^(tomorrow|morgen)$/i.test(value)) {
            let wall = getWallTime(now, formatter);
            if (clock) wall = { ...wall, hour: Number(clock[1]), minute: Number(clock[2]), second: 0 };
            timestamp = clock ? resolveWallTime(wall, formatter) : null;
            if (!clock || (timestamp !== null && timestamp <= now)) {
                const nextDate = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + 1));
                wall = { ...wall, year: nextDate.getUTCFullYear(), month: nextDate.getUTCMonth() + 1, day: nextDate.getUTCDate() };
                timestamp = resolveWallTime(wall, formatter);
            }
        } else {
            try {
                const duration = parseTimespan(value);
                if (duration !== null) timestamp = now + duration;
            } catch {
                return null;
            }
        }
    }
    if (timestamp === null || !Number.isSafeInteger(timestamp) || timestamp <= now || timestamp - now > MAX_DELAY_MS) return null;
    return { timestamp, timespan: `${timestamp - now}ms` };
}

function partsFromMatch(match: RegExpExecArray): WallTime {
    return {
        year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
        hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] ?? 0),
    };
}

function wallAsUtc(wall: WallTime): number {
    return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
}

function validWallTime(wall: WallTime): boolean {
    if (wall.year < 1970 || wall.year > 9999 || wall.hour > 23 || wall.minute > 59 || wall.second > 59) return false;
    const date = new Date(wallAsUtc(wall));
    return date.getUTCFullYear() === wall.year && date.getUTCMonth() + 1 === wall.month && date.getUTCDate() === wall.day;
}

function getWallTime(timestamp: number, formatter: Intl.DateTimeFormat): WallTime {
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
    return {
        year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
        hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
    };
}

function resolveWallTime(wall: WallTime, formatter: Intl.DateTimeFormat): number | null {
    if (!validWallTime(wall)) return null;
    const naive = wallAsUtc(wall);
    const candidates = new Set<number>();
    // Offsets on both sides of a transition expose ambiguous and missing local times.
    for (const hours of [-36, -12, 0, 12, 36]) {
        const probe = naive + hours * 3_600_000;
        const offset = wallAsUtc(getWallTime(probe, formatter)) - probe;
        const candidate = naive - offset;
        if (wallAsUtc(getWallTime(candidate, formatter)) === naive) candidates.add(candidate);
    }
    return candidates.size === 1 ? [...candidates][0]! : null;
}
