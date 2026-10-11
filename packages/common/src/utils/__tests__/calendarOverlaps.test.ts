import { describe, expect, it } from 'vitest';
import { calendarOverlapPage, type OverlapSnapshot, type OverlapSource } from '../calendarOverlaps.js';

const source: OverlapSource = { id: 'source', calendarId: 'calendar', label: 'Private calendar', timezone: 'Europe/Amsterdam', lastSyncedAt: 100 };
const event = (id: string, start: number, end: number | null, extra: Partial<OverlapSnapshot> = {}): OverlapSnapshot => ({
    id, eventId: id, sourceId: source.id, title: id, timezone: 'Europe/Amsterdam', plannedAt: start, endAt: end,
    allDay: false, cancelled: false, ...extra,
});
const page = (snapshots: OverlapSnapshot[], sources = [source], offset = 0, limit = 10) =>
    calendarOverlapPage({ snapshots, sources, now: 1000, until: 10000, offset, limit });

describe('private calendar overlap pages', () => {
    it('includes ongoing events and exact positive intersection, excluding adjacency and expired events', () => {
        const result = page([event('past', 1, 999), event('ongoing', 900, 2000), event('inner', 1100, 1200), event('adjacent', 2000, 3000)]);
        expect(result.total).toBe(1);
        expect(result.overlaps[0]).toMatchObject({ first: { id: 'ongoing' }, second: { id: 'inner' }, startAt: 1100, endAt: 1200 });
    });
    it('rejects all-day, cancelled, missing end, nonpositive end, invalid dates and out-of-horizon events', () => {
        expect(page([event('a', 2000, 3000), event('day', 2000, 3000, { allDay: true }),
            event('cancel', 2000, 3000, { cancelled: true }), event('missing', 2000, null), event('zero', 2000, 2000),
            event('negative', 2000, 1900), event('bad', NaN, 3000), event('badend', 2000, Infinity), event('far', 10000, 12000)]).total).toBe(0);
    });
    it('deduplicates overlapping filters while retaining distinct calendars with the same provider event ID', () => {
        const filtered = { ...source, id: 'filtered', lastSyncedAt: 200 };
        const different = { ...source, id: 'different', calendarId: 'different' };
        const snapshots = [event('a', 2000, 3000), event('copy', 2000, 3000, { sourceId: filtered.id, eventId: 'a' }),
            event('b', 2000, 3000, { sourceId: different.id, eventId: 'a' })];
        const result = page(snapshots, [source, filtered, different]);
        expect(result.total).toBe(1);
        expect(result.overlaps[0].second.id).toBe('copy');
    });
    it.each([{ cancelled: true }, { allDay: true }, { endAt: null }])('fresh authoritative copies suppress stale eligible copies: %j', changes => {
        const fresh = { ...source, id: 'fresh', lastSyncedAt: 200 };
        expect(page([event('a', 2000, 3000), event('copy', 2000, 3000, { ...changes, sourceId: fresh.id, eventId: 'a' }),
            event('b', 2100, 3100)], [source, fresh]).total).toBe(0);
    });
    it('does not include unsynced or absent sources', () => {
        expect(page([event('a', 2000, 3000), event('b', 2100, 3100)], [{ ...source, lastSyncedAt: null }]).total).toBe(0);
        expect(page([event('a', 2000, 3000), event('b', 2100, 3100)], []).total).toBe(0);
    });
    it('counts every pair while retaining only the requested page, including the last page', () => {
        const snapshots = Array.from({ length: 8 }, (_, index) => event(String(index), 2000 + index, 3000));
        const result = page(snapshots, [source], 0, 100);
        expect(result.total).toBe(28);
        const pages = Array.from({ length: 6 }, (_, index) => page(snapshots, [source], index * 5, 5));
        expect(pages.flatMap(item => item.overlaps)).toEqual(result.overlaps);
        expect(pages.every(item => item.total === 28)).toBe(true);
        expect(page(snapshots, [source], 100).overlaps).toEqual([]);
    });
});
