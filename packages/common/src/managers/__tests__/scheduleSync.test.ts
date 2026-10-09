import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserScheduleManager } from '../userScheduleManager.js';
import { ScheduleNotificationManager } from '../scheduleNotificationManager.js';
import type { ImportedOccurrence } from '../scheduleShared.js';
import { CalendarConnection, CalendarSource } from '../../models/calendar-connection.js';
import { CalendarEventSnapshot, CalendarEventSnapshotState } from '../../models/calendar-publication.js';
import { PersonalSchedule, ScheduleNotification, ScheduleOccurrence, SchedulePreferences } from '../../models/personal-schedule.js';

const now = Date.parse('2026-10-07T08:00Z');
const manager = new UserScheduleManager(() => now);
const event: ImportedOccurrence = { seriesKey: 'series', occurrenceKey: 'original', eventId: 'google-event', title: 'Calendar event', timezone: 'UTC',
    plannedAt: now + 60_000, endAt: now + 3_600_000, allDay: false, cancelled: false };
const sync = (events: ImportedOccurrence[], sourceId = 'source', version = 1) => manager.syncSource(sourceId, 'owner', events, now - 86_400_000, now + 366 * 86_400_000, now, version);
beforeEach(async () => {
    await CalendarEventSnapshot.destroy({ where: {} }); await CalendarEventSnapshotState.destroy({ where: {} });
    await ScheduleNotification.destroy({ where: {} }); await ScheduleOccurrence.destroy({ where: {} });
    await PersonalSchedule.destroy({ where: {} }); await SchedulePreferences.destroy({ where: {} });
    await CalendarSource.destroy({ where: {} }); await CalendarConnection.destroy({ where: {} });
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await CalendarConnection.create({ userId: 'owner', status: 'connected', version: 1, expiresAt: 0 });
    await CalendarSource.create({ id: 'source', userId: 'owner', calendarId: 'calendar', label: 'Calendar', timezone: 'UTC', enabled: true, version: 1 });
});
afterEach(() => vi.restoreAllMocks());

describe('calendar occurrence reconciliation', () => {
    it('discards an older authoritative window without cancelling a newer event or rolling back sync time', async () => {
        await manager.syncSource('source', 'owner', [event], now - 86_400_000, now + 366 * 86_400_000, now + 1000, 1);
        const original = (await manager.list('owner', 'all'))[0]!;
        await sync([]);
        expect(await manager.get(original.id, 'owner')).toEqual(original);
        expect(Number((await CalendarSource.findByPk('source'))?.lastSyncedAt)).toBe(now + 1000);
    });

    it('imports stable identity, preserves a parent pause and replaces snooze only when the provider moves the event', async () => {
        await sync([event]);
        const original = (await manager.list('owner', 'all'))[0]!;
        await manager.setEnabled(original.scheduleId, 'owner', false);
        const snoozed = await manager.snooze(original.id, 'owner', 0, now + 600_000);
        await sync([{ ...event, title: 'New title' }]);
        expect((await manager.get(original.id, 'owner'))).toMatchObject({ id: original.id, nextNotifyAt: snoozed.nextNotifyAt, title: 'New title' });
        await sync([{ ...event, plannedAt: now + 7_200_000, endAt: null }]);
        expect(await ScheduleOccurrence.count()).toBe(1);
        expect((await manager.get(original.id, 'owner'))).toMatchObject({ id: original.id, plannedAt: now + 7_200_000, nextNotifyAt: now + 7_200_000 });
        expect((await PersonalSchedule.findByPk(original.scheduleId))?.enabled).toBe(false);
        expect((await ScheduleOccurrence.findByPk(original.id))?.notificationEpoch).toBe(2);
    });

    it('keeps completed snapshots and notes through provider changes and cancellation, without repeated version bumps', async () => {
        await sync([event]);
        const original = (await manager.list('owner', 'all'))[0]!;
        const done = await manager.complete(original.id, 'owner', 0, now - 60_000, 'Recorded');
        await sync([{ ...event, title: 'Renamed', plannedAt: now + 86_400_000, endAt: null }]);
        await sync([{ ...event, title: 'Renamed', plannedAt: now + 86_400_000, endAt: null }]);
        expect(await manager.get(original.id, 'owner')).toEqual(done);
        expect(await CalendarEventSnapshot.findByPk(original.id)).toMatchObject({ title: 'Renamed', plannedAt: now + 86_400_000, cancelled: false });
        await sync([]);
        expect(await manager.get(original.id, 'owner')).toEqual(done);
        expect((await CalendarEventSnapshot.findByPk(original.id))?.cancelled).toBe(true);
        await sync([{ ...event, cancelled: true, title: '', plannedAt: 0 }]);
        expect((await manager.get(original.id, 'owner'))).toMatchObject({ ...done, cancelled: true, version: done.version + 1, nextNotifyAt: null });
        const undone = await manager.undo(original.id, 'owner', done.version + 1);
        expect(undone).toMatchObject({ cancelled: true, state: 'pending', note: 'Recorded', nextNotifyAt: null });
    });

    it('scopes provider tombstones to the selected source even when another selection imports the same event ID', async () => {
        await CalendarSource.create({ id: 'second', userId: 'owner', calendarId: 'calendar', label: 'Filtered', timezone: 'UTC', enabled: true, version: 1 });
        await sync([event]); await sync([event], 'second');
        await sync([{ ...event, seriesKey: 'unknown', occurrenceKey: 'unknown', cancelled: true, title: '', plannedAt: 0 }], 'second');
        const rows = await manager.list('owner', 'all');
        expect(rows.find(row => row.sourceId === 'source')?.cancelled).toBe(false);
        expect(rows.find(row => row.sourceId === 'second')?.cancelled).toBe(true);
        await sync([]);
        expect((await manager.list('owner', 'all')).every(row => row.cancelled)).toBe(true);
        expect(await ScheduleOccurrence.count()).toBe(2);
    });

    it('does not alert initial past history, and rolls back a malformed full snapshot including sync timestamp', async () => {
        await sync([{ ...event, occurrenceKey: 'past', plannedAt: now - 60_000 }]);
        expect((await manager.list('owner', 'unconfirmed'))[0]?.nextNotifyAt).toBeNull();
        const timestamp = (await CalendarSource.findByPk('source'))?.lastSyncedAt;
        await expect(sync([event, { ...event, occurrenceKey: 'invalid', timezone: 'Bad zone' }])).rejects.toMatchObject({ code: 'invalid' });
        expect(await ScheduleOccurrence.count()).toBe(1);
        expect((await CalendarSource.findByPk('source'))?.lastSyncedAt).toBe(timestamp);
        await expect(sync([{ ...event, endAt: event.plannedAt - 1 }])).rejects.toMatchObject({ code: 'invalid' });
        await expect(sync([{ ...event, eventId: '' }])).rejects.toMatchObject({ code: 'invalid' });
    });

    it('rejects stale/disconnected snapshots and keeps history when a selection is removed and reenabled', async () => {
        await sync([event], 'source', 0);
        expect(await ScheduleOccurrence.count()).toBe(0);
        await sync([event]);
        const original = (await manager.list('owner', 'all'))[0]!;
        await manager.deactivateSource('source', 'other');
        expect((await CalendarSource.findByPk('source'))?.enabled).toBe(true);
        await manager.deactivateSource('source', 'owner');
        await sync([{ ...event, plannedAt: now + 7_200_000 }]);
        expect(await manager.get(original.id, 'owner')).toEqual(original);
        await CalendarSource.update({ enabled: true, version: 3 }, { where: { id: 'source' } });
        await sync([event], 'source', 3);
        expect(await ScheduleOccurrence.count()).toBe(1);
        await CalendarConnection.update({ status: 'disconnected' }, { where: { userId: 'owner' } });
        await sync([], 'source', 3);
        expect((await manager.get(original.id, 'owner'))?.cancelled).toBe(false);
        expect(await new ScheduleNotificationManager().claim({ ...original, nextNotifyAt: now }, now)).toBeNull();
    });
});
