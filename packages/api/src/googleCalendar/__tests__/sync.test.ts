import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarConnection, CalendarSource, PersonalSchedule, ScheduleOccurrence } from '@zeffuro/fakegaming-common/models';
import { configManager } from '../../vitest.setup.js';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
const status = vi.hoisted(() => vi.fn());
vi.mock('../../jobs/status.js', () => ({ recordJobRun: status }));
vi.mock('../auth.js', async () => ({ ...await vi.importActual('../auth.js'), getCalendarToken: vi.fn().mockResolvedValue('token') }));
import { processGoogleCalendars, registerGoogleCalendarJobs, syncCalendarSource } from '../sync.js';
import { beginCalendarConnection, completeCalendarConnection, GOOGLE_SCOPES } from '../auth.js';

const userId = 'calendar-sync-owner';
const now = Date.now();
const future = new Date(now + 86_400_000).toISOString();
const event = (id: string, summary: string) => ({ id, summary, start: { dateTime: future }, end: { dateTime: new Date(now + 90_000_000).toISOString() } });
let source: CalendarSource;
describe('calendar snapshots and source mutation guards', () => {
    beforeEach(async () => {
        await ScheduleOccurrence.destroy({ where: { userId } }); await PersonalSchedule.destroy({ where: { userId } });
        await CalendarSource.destroy({ where: { userId } }); await CalendarConnection.destroy({ where: { userId } });
        await CalendarConnection.create({ userId, status: 'connected' });
        source = await CalendarSource.create({ id: randomUUID(), userId, calendarId: 'calendar', label: 'Calendar', timezone: 'UTC', titleFilter: 'medicine', enabled: true, version: 1 });
        vi.stubGlobal('fetch', vi.fn());
    });
    it('applies title filters before bounded storage and makes a fully paginated window authoritative', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [event('medicine', `${'long '.repeat(40)}Medicine`), event('other', 'Meeting')], nextPageToken: 'last' }))
            .mockResolvedValueOnce(Response.json({ items: [event('caps', 'MEDICINE refill')] }));
        await syncCalendarSource(source, now);
        let records = await configManager.userScheduleManager.list(userId, 'all');
        expect(records).toHaveLength(2); expect(records.some(row => row.title === 'Meeting')).toBe(false);
        expect(records.some(row => row.title.length === 160)).toBe(true);
        const completed = records[0]!;
        await configManager.userScheduleManager.complete(completed.id, userId, completed.version, now - 1);
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'last' })).mockResolvedValueOnce(Response.json({ items: [] }));
        await syncCalendarSource(source, now + 1);
        records = await configManager.userScheduleManager.list(userId, 'all');
        expect(records.find(row => row.id === completed.id)).toMatchObject({ state: 'completed', cancelled: false });
        expect(records.filter(row => row.state === 'pending').every(row => row.cancelled)).toBe(true);
    });
    it('does not cancel saved events after later-page failure or malformed provider data', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [event('keep', 'Medicine')] }));
        await syncCalendarSource(source, now);
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'last' })).mockResolvedValueOnce(new Response('', { status: 503 }));
        await expect(syncCalendarSource(source, now + 1)).rejects.toThrow();
        expect(await configManager.userScheduleManager.list(userId, 'all')).toEqual([expect.objectContaining({ cancelled: false, title: 'Medicine' })]);
        expect(Number((await CalendarSource.findByPk(source.id))!.lastSyncedAt)).toBe(now);
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({}));
        await expect(syncCalendarSource(source, now + 2)).rejects.toMatchObject({ code: 'invalid_snapshot' });
        expect(await configManager.userScheduleManager.list(userId, 'all')).toEqual([expect.objectContaining({ cancelled: false, title: 'Medicine' })]);
    });
    it('discards an older overlapping fetch even when both requests start in the same millisecond', async () => {
        let fetched!: () => void;
        const started = new Promise<void>(resolve => { fetched = resolve; });
        let release!: (response: Response) => void;
        vi.mocked(fetch).mockImplementationOnce(async () => { fetched(); return new Promise<Response>(resolve => { release = resolve; }); });
        const older = syncCalendarSource(source, now);
        await started;
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [event('newest', 'Medicine')] }));
        await syncCalendarSource((await CalendarSource.findByPk(source.id))!, now);
        release(Response.json({ items: [] }));
        await older;
        expect(await configManager.userScheduleManager.list(userId, 'all')).toEqual([expect.objectContaining({ cancelled: false, title: 'Medicine' })]);
        expect(Number((await CalendarSource.findByPk(source.id))?.lastSyncedAt)).toBe(now);
    });
    it('invalidates old provider fetches on reconnect while retaining completed history and source selection', async () => {
        vi.stubEnv('GOOGLE_CALENDAR_CLIENT_ID', 'test-client'); vi.stubEnv('GOOGLE_CALENDAR_CLIENT_SECRET', 'test-secret');
        vi.stubEnv('GOOGLE_CALENDAR_REDIRECT_URI', 'http://localhost:3000/api/auth/google-calendar/callback');
        vi.stubEnv('GOOGLE_CALENDAR_TOKEN_ENC_KEY', 'test-encryption-key-at-least-thirty-two-characters');
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [event('completed', 'Medicine')] }));
        await syncCalendarSource(source, now);
        const original = (await configManager.userScheduleManager.list(userId, 'all'))[0]!;
        const completed = await configManager.userScheduleManager.complete(original.id, userId, original.version, now - 1, 'Retained note');
        let fetched!: () => void;
        const started = new Promise<void>(resolve => { fetched = resolve; });
        let release!: (response: Response) => void;
        vi.mocked(fetch).mockImplementationOnce(async () => { fetched(); return new Promise<Response>(resolve => { release = resolve; }); });
        const older = syncCalendarSource(source, now + 1);
        await started;
        const browser = 'b'.repeat(43);
        const pending = await beginCalendarConnection(userId, browser);
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, scope: GOOGLE_SCOPES.join(' ') }));
        await completeCalendarConnection(userId, 'code', pending.state, browser);
        release(Response.json({ items: [event('old-account', 'Medicine')] }));
        await older;
        expect(await configManager.userScheduleManager.list(userId, 'all')).toEqual([completed]);
        expect(await CalendarSource.findByPk(source.id)).toMatchObject({ enabled: true, lastSyncedAt: null });
    });
    it('discards an in-flight snapshot after the owner stops following or disconnects', async () => {
        vi.mocked(fetch).mockImplementationOnce(async () => {
            await configManager.userScheduleManager.deactivateSource(source.id, userId);
            return Response.json({ items: [event('stale', 'Medicine')] });
        });
        await syncCalendarSource(source, now);
        expect(await configManager.userScheduleManager.list(userId, 'all')).toEqual([]);
        await source.reload();
        await source.update({ enabled: true, version: 5 });
        vi.mocked(fetch).mockImplementationOnce(async () => {
            await CalendarConnection.update({ status: 'disconnected' }, { where: { userId } });
            return Response.json({ items: [event('late', 'Medicine')] });
        });
        await syncCalendarSource(source, now);
        expect(await configManager.userScheduleManager.list(userId, 'all')).toEqual([]);
    });
    it('polls due enabled sources and isolates provider failures', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [event('due', 'Medicine')] }));
        expect(await processGoogleCalendars(now)).toMatchObject({ synced: 1, errors: 0 });
        expect(await processGoogleCalendars(now + 60_000)).toEqual({ synced: 0, errors: 0 });
        vi.mocked(fetch).mockRejectedValueOnce(new Error('provider'));
        expect(await processGoogleCalendars(now + 16 * 60_000)).toEqual({ synced: 0, errors: 1 });
    });
    it('coalesces overlap and keeps synchronization scheduled after a database failure', async () => {
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        vi.spyOn(CalendarSource, 'findAll').mockImplementationOnce(async () => { await held; return []; });
        const first = processGoogleCalendars(now);
        expect(await processGoogleCalendars(now)).toEqual({ synced: 0, errors: 0 });
        release(); await first;
        vi.spyOn(CalendarSource, 'findAll').mockRejectedValueOnce(new Error('private token details'));
        const queue = new TestJobQueue();
        await registerGoogleCalendarJobs(queue);
        const run = await runJobHandler(queue, 'google-calendar:sync', {});
        expect(run.done).toHaveBeenCalledOnce();
        expect(queue.scheduled).toHaveLength(2);
        expect(status).toHaveBeenCalledWith('google-calendar', expect.objectContaining({ ok: false, error: 'Calendar synchronization failed' }));
        expect(JSON.stringify(status.mock.calls)).not.toContain('private token details');
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ items: [] }));
        await runJobHandler(queue, 'google-calendar:sync', {});
        expect(status).toHaveBeenLastCalledWith('google-calendar', expect.objectContaining({ ok: true }));
    });
});
