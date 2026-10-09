import { createHash } from 'node:crypto';
import type { ScheduleOccurrence } from '../models/personal-schedule.js';

export interface ScheduleRecord {
    id: string; userId: string; scheduleId: string; title: string; timezone: string;
    plannedAt: number; endAt: number | null; allDay: boolean; cancelled: boolean;
    state: 'pending' | 'completed'; completedAt: number | null; note: string;
    version: number; nextNotifyAt: number | null; notificationCount: number; sourceId: string | null;
}
export interface ImportedOccurrence {
    seriesKey: string; occurrenceKey: string; eventId: string; title: string; timezone: string;
    plannedAt: number; endAt: number | null; allDay: boolean; cancelled: boolean;
}
export interface ScheduleSettings {
    timezone: string; quietStart: string | null; quietEnd: string | null;
    followupMinutes: number; maxFollowups: number;
}
export class ScheduleError extends Error {
    constructor(public readonly code: 'invalid' | 'missing' | 'stale' | 'capacity') { super(code); }
}
export function scheduleKey(...parts: string[]): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
export function scheduleTimezone(value: string): string {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); } catch { throw new ScheduleError('invalid'); }
    return value;
}
export function nextScheduleWeek(timestamp: number, weeks: number, timezone: string, anchorAt = timestamp): number {
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const partsOf = (value: number) => Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
    const parts = partsOf(timestamp);
    const clock = partsOf(anchorAt);
    const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + weeks * 7));
    const desired = date.getTime() + Number(clock.hour) * 3_600_000 + Number(clock.minute) * 60_000 + Number(clock.second) * 1000;
    const wallUtc = (value: number) => {
        const local = partsOf(value);
        return Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute), Number(local.second));
    };
    const candidates = [...new Set([-36, -12, 0, 12, 36].map(hours => {
        const probe = desired + hours * 3_600_000;
        return desired - (wallUtc(probe) - probe);
    }))].sort((a, b) => a - b);
    // Use the earlier overlap and move a missing clock time forward by the DST gap; later weeks use the original clock.
    const next = candidates.find(candidate => wallUtc(candidate) === desired)
        ?? candidates.find(candidate => wallUtc(candidate) > desired && wallUtc(candidate) - desired <= 86_400_000);
    if (next === undefined) throw new ScheduleError('invalid');
    return next + (anchorAt % 1000);
}
export function occurrenceRecord(row: ScheduleOccurrence, sourceId: string | null): ScheduleRecord {
    return { id: row.id, userId: row.userId, scheduleId: row.scheduleId, title: row.title, timezone: row.timezone,
        plannedAt: Number(row.plannedAt), endAt: row.endAt === null ? null : Number(row.endAt), allDay: row.allDay, cancelled: row.cancelled,
        state: row.state, completedAt: row.completedAt === null ? null : Number(row.completedAt), note: row.note, version: row.version,
        nextNotifyAt: row.nextNotifyAt === null ? null : Number(row.nextNotifyAt), notificationCount: row.notificationCount, sourceId };
}
