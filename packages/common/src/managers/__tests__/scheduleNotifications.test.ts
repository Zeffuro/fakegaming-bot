import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserScheduleManager } from '../userScheduleManager.js';
import { ScheduleNotificationManager } from '../scheduleNotificationManager.js';
import { CalendarConnection, CalendarSource } from '../../models/calendar-connection.js';
import { PersonalSchedule, ScheduleNotification, ScheduleOccurrence, SchedulePreferences } from '../../models/personal-schedule.js';

const now = Date.parse('2026-10-07T08:00:00Z');
const schedules = new UserScheduleManager(() => now);
const notifications = new ScheduleNotificationManager();
beforeEach(async () => {
    await ScheduleNotification.destroy({ where: {} }); await ScheduleOccurrence.destroy({ where: {} });
    await PersonalSchedule.destroy({ where: {} }); await SchedulePreferences.destroy({ where: {} });
    await CalendarSource.destroy({ where: {} }); await CalendarConnection.destroy({ where: {} });
    vi.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => vi.restoreAllMocks());
async function due(userId = 'owner') {
    const item = await schedules.createManual({ userId, title: 'Reminder', timezone: 'UTC', plannedAt: now + 60_000 });
    await ScheduleOccurrence.update({ nextNotifyAt: now - 1 }, { where: { id: item.id } });
    return (await schedules.get(item.id, userId))!;
}

describe('durable schedule notification claims', () => {
    it('allows one concurrent claim and does not replay an interrupted send after a note edit or restart', async () => {
        const item = await due();
        const claims = await Promise.all([notifications.claim(item, now), new ScheduleNotificationManager().claim(item, now)]);
        expect(claims.filter(Boolean)).toHaveLength(1);
        const updated = await schedules.note(item.id, 'owner', 0, 'New note');
        expect(await notifications.claim(updated, now)).toBeNull();
        await new ScheduleNotificationManager().recover(now + 6 * 60_000);
        expect((await ScheduleNotification.findOne())?.status).toBe('uncertain');
        expect((await schedules.get(item.id, 'owner'))?.nextNotifyAt).toBeNull();
        expect(await notifications.due(now + 100 * 86_400_000)).toEqual([]);
    });

    it('retries definite rejection and sends only the configured number of follow-ups', async () => {
        await schedules.configure('owner', { timezone: 'UTC', quietStart: null, quietEnd: null, followupMinutes: 15, maxFollowups: 1 });
        const item = await due();
        const attempt = (await notifications.claim(item, now))!;
        await notifications.settle(attempt.id, 'rejected', now);
        expect(await notifications.due(now + 4 * 60_000)).toEqual([]);
        const retryItem = (await notifications.due(now + 5 * 60_000))[0]!;
        const retry = (await notifications.claim(retryItem, now + 5 * 60_000))!;
        expect(retry.id).toBe(attempt.id);
        await notifications.settle(retry.id, 'sent', now + 5 * 60_000, '123', '456');
        await notifications.settle(retry.id, 'sent', now + 5 * 60_000, '123', '456');
        const followup = (await notifications.due(now + 20 * 60_000))[0]!;
        expect(followup.notificationCount).toBe(1);
        const second = (await notifications.claim(followup, now + 20 * 60_000))!;
        await notifications.settle(second.id, 'sent', now + 20 * 60_000, '124', '456');
        expect(await notifications.due(now + 86_400_000)).toEqual([]);
        expect(await ScheduleNotification.count()).toBe(2);
    });

    it('keeps a newer snooze generation when the old in-flight attempt settles', async () => {
        const item = await due();
        const first = (await notifications.claim(item, now))!;
        const snoozed = await schedules.snooze(item.id, 'owner', 0, now + 60_000);
        await notifications.settle(first.id, 'sent', now, '123', '456');
        expect((await schedules.get(item.id, 'owner'))?.nextNotifyAt).toBe(now + 60_000);
        const second = (await notifications.claim(snoozed, now + 60_000))!;
        expect(second.id).not.toBe(first.id);
        await schedules.complete(item.id, 'owner', snoozed.version);
        await notifications.settle(second.id, 'rejected', now + 60_000);
        expect((await schedules.get(item.id, 'owner'))).toMatchObject({ state: 'completed', nextNotifyAt: null });
        expect(await notifications.messagesToRefresh()).toHaveLength(1);
        await notifications.rendered(first.id, 2);
        expect(await notifications.messagesToRefresh()).toHaveLength(0);
        await schedules.note(item.id, 'owner', 2, 'Preserved');
        await notifications.rendered(first.id, 3, true);
        expect(await notifications.messagesToRefresh()).toEqual([]);
        expect((await schedules.get(item.id, 'owner'))?.note).toBe('Preserved');
    });

    it('does not claim stale, cancelled, completed, paused or wrong-owner resources', async () => {
        const item = await due();
        expect(await notifications.claim({ ...item, userId: 'other' }, now)).toBeNull();
        const noted = await schedules.note(item.id, 'owner', 0, 'Edited');
        expect(await notifications.claim(item, now)).toBeNull();
        await schedules.setEnabled(item.scheduleId, 'owner', false);
        expect(await notifications.claim(noted, now)).toBeNull();
        await schedules.setEnabled(item.scheduleId, 'owner', true);
        await ScheduleOccurrence.update({ cancelled: true }, { where: { id: item.id } });
        expect(await notifications.claim(noted, now)).toBeNull();
        await schedules.complete(item.id, 'owner', noted.version);
        expect(await notifications.claim((await schedules.get(item.id, 'owner'))!, now)).toBeNull();
        await notifications.settle('missing', 'sent', now);
    });

    it('filters paused, disconnected and quiet schedules before the 100-row delivery budget', async () => {
        const blocked = await due('quiet');
        await schedules.configure('quiet', { timezone: 'UTC', quietStart: '00:00', quietEnd: '00:00', followupMinutes: 0, maxFollowups: 0 });
        await ScheduleOccurrence.bulkCreate(Array.from({ length: 110 }, (_, index) => ({ ...(ScheduleOccurrence.build()).get(),
            id: `blocked-${index}`, userId: 'quiet', scheduleId: blocked.scheduleId, externalKey: `blocked-${index}`, title: 'Quiet', timezone: 'UTC',
            plannedAt: now - 1000, allDay: false, cancelled: false, state: 'pending', note: '', version: 0, nextNotifyAt: now - 1000, notificationCount: 0 })));
        const active = await due('active');
        expect((await notifications.due(now)).map(row => row.id)).toEqual([active.id]);
        expect(await notifications.claim(blocked, now)).toBeNull();
        await schedules.setEnabled(active.scheduleId, 'active', false);
        expect(await notifications.due(now)).toEqual([]);
        await schedules.setEnabled(active.scheduleId, 'active', true);
        await PersonalSchedule.update({ sourceId: 'calendar' }, { where: { id: active.scheduleId } });
        expect(await notifications.due(now)).toEqual([]);
        expect(await notifications.claim({ ...active, sourceId: 'calendar' }, now)).toBeNull();
        await CalendarSource.create({ id: 'calendar', userId: 'active', calendarId: 'gcal', label: 'Calendar', timezone: 'UTC', enabled: true, version: 1 });
        await CalendarConnection.create({ userId: 'active', status: 'connected', version: 1, expiresAt: 0 });
        expect((await notifications.due(now)).map(row => row.id)).toEqual([active.id]);
        await schedules.deactivateSource('calendar', 'active');
        expect(await notifications.due(now)).toEqual([]);
        expect((await PersonalSchedule.findByPk(active.scheduleId))?.enabled).toBe(true);
    });

    it('enforces a reduced follow-up limit at claim time', async () => {
        const item = await due();
        await ScheduleOccurrence.update({ notificationCount: 2 }, { where: { id: item.id } });
        expect(await notifications.claim(item, now)).toBeNull();
        expect((await schedules.get(item.id, 'owner'))?.nextNotifyAt).toBeNull();
    });
});
