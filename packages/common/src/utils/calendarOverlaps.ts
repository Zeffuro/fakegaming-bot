export interface OverlapSource {
    id: string;
    calendarId: string;
    label: string;
    timezone: string;
    lastSyncedAt: number | null;
}

export interface OverlapSnapshot {
    id: string;
    sourceId: string;
    eventId: string;
    title: string;
    timezone: string;
    plannedAt: number;
    endAt: number | null;
    allDay: boolean;
    cancelled: boolean;
}

export interface OverlapEvent {
    id: string;
    title: string;
    sourceLabel: string;
    timezone: string;
    startAt: number;
    endAt: number;
}

export interface CalendarOverlap { first: OverlapEvent; second: OverlapEvent; startAt: number; endAt: number }

export function calendarOverlapPage(input: {
    snapshots: readonly OverlapSnapshot[];
    sources: readonly OverlapSource[];
    now: number;
    until: number;
    offset: number;
    limit: number;
}): { overlaps: CalendarOverlap[]; total: number } {
    const sources = new Map(input.sources.map(source => [source.id, source]));
    const unique = new Map<string, { snapshot: OverlapSnapshot; source: OverlapSource }>();
    for (const snapshot of input.snapshots) {
        const source = sources.get(snapshot.sourceId);
        if (!source || source.lastSyncedAt === null) continue;
        const key = JSON.stringify([source.calendarId, snapshot.eventId]);
        const previous = unique.get(key);
        // Overlapping filters can import the same event; the freshest copy wins.
        if (!previous || Number(source.lastSyncedAt) > Number(previous.source.lastSyncedAt)
            || (Number(source.lastSyncedAt) === Number(previous.source.lastSyncedAt) && snapshot.id < previous.snapshot.id)) {
            unique.set(key, { snapshot, source });
        }
    }
    const events: OverlapEvent[] = [];
    for (const { snapshot, source } of unique.values()) {
        const startAt = Number(snapshot.plannedAt);
        const endAt = snapshot.endAt === null ? NaN : Number(snapshot.endAt);
        if (snapshot.cancelled || snapshot.allDay || !Number.isFinite(startAt) || !Number.isFinite(endAt)
            || endAt <= startAt || endAt <= input.now || startAt >= input.until) continue;
        events.push({ id: snapshot.id, title: snapshot.title, sourceLabel: source.label,
            timezone: snapshot.timezone || source.timezone, startAt, endAt });
    }
    events.sort((a, b) => a.startAt - b.startAt || a.id.localeCompare(b.id));
    const overlaps: CalendarOverlap[] = [];
    let total = 0;
    let active: OverlapEvent[] = [];
    for (const event of events) {
        active = active.filter(other => other.endAt > event.startAt);
        for (const other of active) {
            if (total >= input.offset && overlaps.length < input.limit) {
                overlaps.push({ first: other, second: event, startAt: Math.max(other.startAt, event.startAt),
                    endAt: Math.min(other.endAt, event.endAt) });
            }
            total += 1;
        }
        active.push(event);
    }
    return { overlaps, total };
}
