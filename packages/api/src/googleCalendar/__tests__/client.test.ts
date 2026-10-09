import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../auth.js', async () => ({ ...await vi.importActual('../auth.js'), getCalendarToken: vi.fn().mockResolvedValue('token') }));
import { calendarDateAtNine, fetchGoogleOccurrences, listGoogleCalendars, normalizeGoogleEvent } from '../client.js';

const event = { id: 'instance', recurringEventId: 'series', summary: 'Planned item', originalStartTime: { dateTime: '2026-10-20T10:00:00+02:00' }, start: { dateTime: '2026-10-21T12:00:00+02:00' }, end: { dateTime: '2026-10-21T13:00:00+02:00' } };
describe('authoritative Google Calendar snapshots', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
    it('keeps stable original instance identity when a recurring occurrence moves', () => {
        const moved = normalizeGoogleEvent(event, 'Europe/Amsterdam');
        expect(moved).toMatchObject({ seriesKey: 'series', occurrenceKey: `time:${Date.parse('2026-10-20T08:00:00Z')}`, plannedAt: Date.parse('2026-10-21T10:00:00Z') });
        const cancellation = normalizeGoogleEvent({ id: 'instance', status: 'cancelled', recurringEventId: 'series', originalStartTime: event.originalStartTime }, 'Europe/Amsterdam');
        expect(cancellation).toMatchObject({ occurrenceKey: moved.occurrenceKey, eventId: 'instance', cancelled: true, plannedAt: 0 });
        expect(normalizeGoogleEvent({ id: 'deleted', status: 'cancelled' }, 'UTC')).toMatchObject({ eventId: 'deleted', cancelled: true });
    });
    it('preserves all-day local 09:00 across DST and rejects malformed dates and active instances', () => {
        expect(calendarDateAtNine('2026-03-28', 'Europe/Amsterdam')).toBe(Date.parse('2026-03-28T08:00:00Z'));
        expect(calendarDateAtNine('2026-03-29', 'Europe/Amsterdam')).toBe(Date.parse('2026-03-29T07:00:00Z'));
        expect(calendarDateAtNine('2026-10-25', 'Europe/Amsterdam')).toBe(Date.parse('2026-10-25T08:00:00Z'));
        expect(normalizeGoogleEvent({ id: 'all-day', summary: 'Item', start: { date: '2026-03-29' }, end: { date: '2026-03-30' } }, 'Europe/Amsterdam')).toMatchObject({ allDay: true, plannedAt: Date.parse('2026-03-29T07:00:00Z'), endAt: Date.parse('2026-03-30T07:00:00Z') });
        expect(() => calendarDateAtNine('2026-02-30', 'UTC')).toThrow();
        expect(() => normalizeGoogleEvent({ id: 'missing-start' }, 'UTC')).toThrow();
        expect(() => normalizeGoogleEvent({ ...event, originalStartTime: undefined }, 'UTC')).toThrow();
        expect(normalizeGoogleEvent({ id: 'zoned', start: { dateTime: '2026-03-29T09:00:00', timeZone: 'Europe/Amsterdam' }, end: { dateTime: '2026-03-29T10:00:00', timeZone: 'Europe/Amsterdam' } }, 'UTC')).toMatchObject({ plannedAt: Date.parse('2026-03-29T07:00:00Z') });
        expect(() => normalizeGoogleEvent({ id: 'ambiguous', start: { dateTime: '2026-10-25T02:30:00', timeZone: 'Europe/Amsterdam' }, end: { dateTime: '2026-10-25T03:30:00', timeZone: 'Europe/Amsterdam' } }, 'UTC')).toThrow();
    });
    it('paginates expanded recurring events and discards partial failures or repeated cursors', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [event], nextPageToken: 'second' })).mockResolvedValueOnce(Response.json({ items: [{ id: 'deleted', status: 'cancelled' }] }));
        const result = await fetchGoogleOccurrences('owner', 'a/b', 'UTC', Date.now(), Date.now() + 86_400_000);
        expect(result).toHaveLength(2);
        const url = new URL(vi.mocked(fetch).mock.calls[1]![0] as string);
        expect(url.pathname).toContain('a%2Fb');
        expect(url.searchParams.get('singleEvents')).toBe('true');
        expect(url.searchParams.get('showDeleted')).toBe('true');
        expect(url.searchParams.get('pageToken')).toBe('second');
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [event], nextPageToken: 'second' })).mockResolvedValueOnce(new Response('', { status: 503 }));
        await expect(fetchGoogleOccurrences('owner', 'calendar', 'UTC', Date.now(), Date.now() + 1)).rejects.toMatchObject({ code: 'provider_unavailable' });
        vi.mocked(fetch).mockImplementation(() => Promise.resolve(Response.json({ items: [], nextPageToken: 'loop' })));
        await expect(fetchGoogleOccurrences('owner', 'calendar', 'UTC', Date.now(), Date.now() + 1)).rejects.toMatchObject({ code: 'invalid_snapshot' });
    });
    it('loads every calendar page and removes deleted or free/busy-only calendars', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [{ id: 'one', summary: 'One', timeZone: 'UTC' }], nextPageToken: 'next' }))
            .mockResolvedValueOnce(Response.json({ items: [{ id: 'two', timeZone: 'Europe/Amsterdam' }, { id: 'deleted', deleted: true, timeZone: 'UTC' }, { id: 'busy', accessRole: 'freeBusyReader', timeZone: 'UTC' }] }));
        expect(await listGoogleCalendars('owner')).toEqual([{ id: 'one', summary: 'One', timeZone: 'UTC' }, { id: 'two', summary: 'two', timeZone: 'Europe/Amsterdam' }]);
    });
    it('rejects malformed provider pages and bounds body sizes', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [{ ...event, start: { dateTime: 'missing-offset' } }] }));
        await expect(fetchGoogleOccurrences('owner', 'calendar', 'UTC', Date.now(), Date.now() + 1)).rejects.toMatchObject({ code: 'invalid_snapshot' });
        vi.mocked(fetch).mockResolvedValueOnce(new Response(' '.repeat(2_000_001)));
        await expect(listGoogleCalendars('owner')).rejects.toMatchObject({ code: 'invalid_snapshot' });
    });
});
