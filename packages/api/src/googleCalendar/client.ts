import { z } from 'zod';
import { CalendarError, getCalendarToken, googleJson } from './auth.js';

export interface GoogleCalendarItem { id: string; summary: string; timeZone: string }
export interface ImportedCalendarOccurrence {
    seriesKey: string; occurrenceKey: string; eventId: string; title: string; timezone: string;
    plannedAt: number; endAt: number | null; allDay: boolean; cancelled: boolean;
}
const timezone = z.string().max(100).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
});
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
});
const hasOffset = (value: string) => /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
const dateTime = z.string().max(100).regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/)
    .refine(value => Number.isFinite(Date.parse(hasOffset(value) ? value : `${value}Z`)) && date.safeParse(value.slice(0, 10)).success);
const timeSchema = z.object({ date: date.optional(), dateTime: dateTime.optional(), timeZone: timezone.optional() })
    .refine(value => Boolean(value.date) !== Boolean(value.dateTime) && (!value.dateTime || hasOffset(value.dateTime) || Boolean(value.timeZone)));
const eventSchema = z.object({ id: z.string().min(1).max(1024), status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
    summary: z.string().max(10000).optional(), recurringEventId: z.string().min(1).max(1024).optional(), originalStartTime: timeSchema.optional(),
    start: timeSchema.optional(), end: timeSchema.optional() });
const eventPage = z.object({ items: z.array(eventSchema).max(2500).optional(), nextPageToken: z.string().min(1).max(4096).optional(), timeZone: timezone.optional() })
    .refine(value => value.items !== undefined || value.timeZone !== undefined);
const calendarPage = z.object({ items: z.array(z.object({ id: z.string().min(1).max(1024), summary: z.string().max(10000).optional(),
    timeZone: timezone, deleted: z.boolean().optional(), accessRole: z.enum(['none', 'freeBusyReader', 'reader', 'writerWithoutPrivateAccess', 'writer', 'owner']).optional() })).max(250).default([]), nextPageToken: z.string().min(1).max(4096).optional() });

async function authorizedJson(userId: string, path: string, params: URLSearchParams): Promise<unknown> {
    const token = await getCalendarToken(userId);
    return googleJson(`https://www.googleapis.com/calendar/v3/${path}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
}

export async function listGoogleCalendars(userId: string): Promise<GoogleCalendarItem[]> {
    const calendars: GoogleCalendarItem[] = [];
    const seen = new Set<string>();
    let next: string | undefined;
    for (let page = 0; page < 40; page += 1) {
        const params = new URLSearchParams({ maxResults: '250', showHidden: 'true', fields: 'items(id,summary,timeZone,deleted,accessRole),nextPageToken' });
        if (next) params.set('pageToken', next);
        const parsed = calendarPage.safeParse(await authorizedJson(userId, 'users/me/calendarList', params));
        if (!parsed.success) throw new CalendarError('invalid_snapshot');
        calendars.push(...parsed.data.items.filter(item => !item.deleted && !['none', 'freeBusyReader'].includes(item.accessRole ?? 'reader'))
            .map(item => ({ id: item.id, summary: item.summary || item.id, timeZone: item.timeZone })));
        next = parsed.data.nextPageToken;
        if (!next) return calendars;
        if (seen.has(next)) throw new CalendarError('invalid_snapshot');
        seen.add(next);
    }
    throw new CalendarError('invalid_snapshot');
}

export function calendarDateAtNine(value: string, zone: string): number {
    if (!date.safeParse(value).success || !timezone.safeParse(zone).success) throw new CalendarError('invalid_snapshot');
    return localTimestamp(`${value}T09:00:00`, zone);
}

function localTimestamp(value: string, zone: string): number {
    const target = Date.parse(`${value}Z`);
    const format = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const wall = (at: number) => {
        const parts = Object.fromEntries(format.formatToParts(at).map(part => [part.type, part.value]));
        return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second), new Date(at).getUTCMilliseconds());
    };
    const matches = new Set<number>();
    for (const hours of [-36, 0, 36]) {
        const probe = target + hours * 3_600_000;
        const candidate = target - (wall(probe) - probe);
        if (wall(candidate) === target) matches.add(candidate);
    }
    if (matches.size !== 1) throw new CalendarError('invalid_snapshot');
    return [...matches][0]!;
}

function timeKey(value: z.infer<typeof timeSchema>): string {
    return value.date ? `date:${value.date}` : `time:${timestampOf(value)}`;
}

function timestampOf(value: z.infer<typeof timeSchema>): number {
    return hasOffset(value.dateTime!) ? Date.parse(value.dateTime!) : localTimestamp(value.dateTime!, value.timeZone!);
}

export function normalizeGoogleEvent(raw: unknown, fallbackTimezone: string): ImportedCalendarOccurrence {
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) throw new CalendarError('invalid_snapshot');
    const event = parsed.data;
    const cancelled = event.status === 'cancelled';
    if (!cancelled && (!event.start || !event.end || (event.recurringEventId && !event.originalStartTime))) throw new CalendarError('invalid_snapshot');
    const zone = event.start?.timeZone ?? fallbackTimezone;
    if (!timezone.safeParse(zone).success) throw new CalendarError('invalid_snapshot');
    const start = event.start;
    const end = event.end;
    if (start && end && Boolean(start.date) !== Boolean(end.date)) throw new CalendarError('invalid_snapshot');
    const plannedAt = start?.date ? calendarDateAtNine(start.date, zone) : start?.dateTime ? timestampOf(start) : 0;
    const endAt = end?.date ? calendarDateAtNine(end.date, zone) : end?.dateTime ? timestampOf(end) : null;
    if (!cancelled && endAt !== null && endAt < plannedAt) throw new CalendarError('invalid_snapshot');
    return { seriesKey: event.recurringEventId ?? event.id,
        occurrenceKey: event.originalStartTime ? timeKey(event.originalStartTime) : event.id, eventId: event.id,
        title: event.summary ?? '', timezone: zone, plannedAt, endAt, allDay: Boolean(start?.date), cancelled };
}

export async function fetchGoogleOccurrences(userId: string, calendarId: string, zone: string, windowStart: number, windowEnd: number): Promise<ImportedCalendarOccurrence[]> {
    const events: ImportedCalendarOccurrence[] = [];
    const seen = new Set<string>();
    let next: string | undefined;
    for (let page = 0; page < 40; page += 1) {
        const params = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', maxResults: '2500',
            fields: 'items(id,status,summary,recurringEventId,originalStartTime,start,end),nextPageToken,timeZone',
            timeMin: new Date(windowStart).toISOString(), timeMax: new Date(windowEnd).toISOString(), timeZone: zone });
        if (next) params.set('pageToken', next);
        const parsed = eventPage.safeParse(await authorizedJson(userId, `calendars/${encodeURIComponent(calendarId)}/events`, params));
        if (!parsed.success) throw new CalendarError('invalid_snapshot');
        events.push(...(parsed.data.items ?? []).map(item => normalizeGoogleEvent(item, parsed.data.timeZone ?? zone)));
        if (events.length > 10_000) throw new CalendarError('invalid_snapshot');
        next = parsed.data.nextPageToken;
        if (!next) return events;
        if (seen.has(next)) throw new CalendarError('invalid_snapshot');
        seen.add(next);
    }
    throw new CalendarError('invalid_snapshot');
}
