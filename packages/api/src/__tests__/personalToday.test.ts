import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { CalendarConnection, CalendarSource, PersonalSchedule, ScheduleOccurrence, UserTask, UserSession, UserCountdown } from '@zeffuro/fakegaming-common/models';
import { givenAuthenticatedClient, expectOk, expectNotFound, expectBadRequest, expectUnauthorized, expectConflict, expectForbidden, type AuthClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
import { configManager as cm } from '../vitest.setup.js';
import { UserTaskManager, UserSessionManager, UserCountdownManager, UserScheduleManager } from '@zeffuro/fakegaming-common/managers';

const ownerId = 'today-owner';
const now = Date.UTC(2026, 9, 9, 10);
const originalManagers = { task: cm.userTaskManager, session: cm.userSessionManager, countdown: cm.userCountdownManager, schedule: cm.userScheduleManager };
const patch = (client: AuthClient, path: string, body: object) => client.raw.patch(path).set('Authorization', `Bearer ${client.token}`).send(body);
const newTask = (title = 'Private task') => cm.userTaskManager.create({ userId: ownerId, title, timezone: 'Europe/Amsterdam', dueAt: now + 60_000, checklist: ['First'] });

describe('Personal Today owner API', () => {
    it('moves tasks to tomorrow privately in the saved timezone without accepting caller dates', async () => {
        const client = givenAuthenticatedClient(app, { discordId: ownerId });
        const task = await newTask(); const path = `/api/personalToday/tasks/${task.id}`;
        expectNotFound(await patch(givenAuthenticatedClient(app, { discordId: 'other' }), path, { action: 'tomorrow', version: 0 }));
        expectBadRequest(await patch(client, path, { action: 'tomorrow', version: 0, dueAt: 1 }));
        const moved = await patch(client, path, { action: 'tomorrow', version: 0 });
        expectOk(moved); expect(moved.body).toMatchObject({ dueAt: now + 86_400_000 + 60_000, version: 1, checklist: task.checklist });
        expect((await client.get('/api/personalToday')).body.tasks).toEqual([]);
        expectConflict(await patch(client, path, { action: 'tomorrow', version: 0 }));
        expectUnauthorized(await patch(givenAuthenticatedClient(app, { discordId: 'service:worker' }), path, { action: 'tomorrow', version: 1 }));
    });
    beforeEach(async () => {
        vi.spyOn(Date, 'now').mockReturnValue(now);
        cm.userTaskManager = new UserTaskManager(() => now);
        cm.userSessionManager = new UserSessionManager(() => now);
        cm.userCountdownManager = new UserCountdownManager(() => now);
        cm.userScheduleManager = new UserScheduleManager(() => now);
        await ScheduleOccurrence.destroy({ where: {} });
        await PersonalSchedule.destroy({ where: {} });
        await UserTask.destroy({ where: {} });
        await UserSession.destroy({ where: {} });
        await UserCountdown.destroy({ where: {} });
        await CalendarSource.destroy({ where: {} });
        await CalendarConnection.destroy({ where: {} });
        await cm.reminderManager.removeAll();
        await cm.userManager.removeAll();
        await cm.userManager.setUser({ discordId: ownerId, timezone: 'Europe/Amsterdam' });
    });
    afterEach(() => {
        cm.userTaskManager = originalManagers.task; cm.userSessionManager = originalManagers.session;
        cm.userCountdownManager = originalManagers.countdown; cm.userScheduleManager = originalManagers.schedule;
    });
    it('combines owner data without duplicate delivery reminders or another owner records', async () => {
        const client = givenAuthenticatedClient(app, { discordId: ownerId });
        const task = await newTask();
        await cm.userTaskManager.create({ userId: 'other', title: 'Someone else', timezone: 'UTC' });
        await cm.reminderManager.createForUser({ id: randomUUID(), userId: ownerId, message: 'Plain reminder', timespan: '1h', timestamp: now + 3_600_000 });
        await cm.userCountdownManager.create({ userId: ownerId, title: 'Upcoming', dueAt: now + 86_400_000, timezone: 'UTC', dueMessage: 'Due', advanceMessage: 'Soon' });
        await cm.userSessionManager.start({ userId: ownerId, title: 'Working', kind: 'focus', messages: { focus: 'Focus', break: 'Break', finished: 'Done', takeBreak: 'Rest' } });
        const result = await client.get('/api/personalToday');
        expectOk(result);
        expect(result.headers['cache-control']).toBe('private, no-store');
        expect(result.body).toMatchObject({ day: '2026-10-09', timezone: 'Europe/Amsterdam', session: { title: 'Working' } });
        expect(result.body.tasks.map((item: { id: string }) => item.id)).toEqual([task.id]);
        expect(result.body.reminders.map((item: { title: string }) => item.title)).toEqual(['Plain reminder']);
        expect(result.body.countdowns).toHaveLength(1);
        expectOk(await givenAuthenticatedClient(app, { discordId: 'empty-owner' }).get('/api/personalToday'));
        expectUnauthorized(await client.raw.get('/api/personalToday'));
        expectBadRequest(await client.get('/api/personalToday?userId=other'));
    });
    it('checks owner/version and handles checklist, snooze and task completion', async () => {
        const client = givenAuthenticatedClient(app, { discordId: ownerId });
        const other = givenAuthenticatedClient(app, { discordId: 'other' });
        const task = await newTask();
        const path = `/api/personalToday/tasks/${task.id}`;
        expectNotFound(await patch(other, path, { action: 'done', version: 0 }));
        const checked = await patch(client, path, { action: 'check', version: 0, index: 0 });
        expectOk(checked); expect(checked.body.checklist[0].done).toBe(true);
        expectConflict(await patch(client, path, { action: 'done', version: 0 }));
        const snoozed = await patch(client, path, { action: 'snooze', version: 1, minutes: 60 });
        expectOk(snoozed); expect(snoozed.body.dueAt).toBe(now + 3_600_000);
        expectOk(await patch(client, path, { action: 'done', version: 2 }));
        expect((await client.get('/api/personalToday')).body.tasks).toEqual([]);
        expectBadRequest(await patch(client, path, { action: 'snooze', version: 3, minutes: 0 }));
    });
    it('undoes completion privately with exact progress, version checks and no internal snapshot exposure', async () => {
        const client = givenAuthenticatedClient(app, { discordId: ownerId });
        const task = await newTask();
        const path = `/api/personalToday/tasks/${task.id}`;
        const done = await patch(client, path, { action: 'done', version: 0 });
        expectOk(done); expect(done.body.canUndo).toBe(true);
        expect(done.body).not.toHaveProperty('undoCompletionJson');
        expectNotFound(await patch(givenAuthenticatedClient(app, { discordId: 'other' }), path, { action: 'undo', version: 1 }));
        expectConflict(await patch(client, path, { action: 'undo', version: 0 }));
        const undone = await patch(client, path, { action: 'undo', version: 1 });
        expectOk(undone); expect(undone.body).toMatchObject({ state: 'active', checklist: task.checklist, dueAt: task.dueAt, canUndo: false, version: 2 });
        expect((await client.get('/api/personalToday')).body.tasks).toHaveLength(1);
        expectConflict(await patch(client, path, { action: 'undo', version: 2 }));
        expectBadRequest(await patch(client, path, { action: 'undo', version: 2, userId: 'other' }));
        expectUnauthorized(await patch(givenAuthenticatedClient(app, { discordId: 'service:worker' }), path, { action: 'undo', version: 2 }));
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try { expectForbidden(await patch(client, path, { action: 'undo', version: 2 })); }
        finally { vi.unstubAllEnvs(); }
    });
    it('operates schedule completion/snooze privately and keeps source planning unchanged', async () => {
        const client = givenAuthenticatedClient(app, { discordId: ownerId });
        const occurrence = await cm.userScheduleManager.createManual({ userId: ownerId, title: 'Private schedule', plannedAt: now + 60_000, timezone: 'UTC' });
        const path = `/api/personalToday/schedules/${occurrence.id}`;
        expectNotFound(await patch(givenAuthenticatedClient(app, { discordId: 'other' }), path, { action: 'complete', version: 0 }));
        const snoozed = await patch(client, path, { action: 'snooze', version: 0, minutes: 60 });
        expectOk(snoozed); expect(snoozed.body.plannedAt).toBe(occurrence.plannedAt);
        expect(snoozed.body.nextNotifyAt).toBe(now + 3_600_000);
        expectOk(await patch(client, path, { action: 'complete', version: 1 }));
        expect((await client.get('/api/personalToday')).body.schedules).toEqual([]);
    });
    it('pauses/resumes/stops owner session and rejects stale or foreign actions', async () => {
        const client = givenAuthenticatedClient(app, { discordId: ownerId });
        const session = await cm.userSessionManager.start({ userId: ownerId, title: 'Play', kind: 'gaming', messages: { focus: 'Focus', break: 'Break', finished: 'Done', takeBreak: 'Rest' } });
        const path = `/api/personalToday/sessions/${session.id}`;
        expectNotFound(await patch(givenAuthenticatedClient(app, { discordId: 'other' }), path, { action: 'pause', version: 0 }));
        expectOk(await patch(client, path, { action: 'pause', version: 0 }));
        expectConflict(await patch(client, path, { action: 'resume', version: 0 }));
        expectOk(await patch(client, path, { action: 'resume', version: 1 }));
        expectOk(await patch(client, path, { action: 'stop', version: 2 }));
        expect((await client.get('/api/personalToday')).body.session).toBeNull();
    });
    it('hides stopped/disconnected imports and rejects stale snooze actions against them', async () => {
        const client = givenAuthenticatedClient(app, { discordId: ownerId });
        const source = await CalendarSource.create({ id: randomUUID(), userId: ownerId, calendarId: 'private-calendar', label: 'Calendar', timezone: 'UTC', titleFilter: null, enabled: true, version: 1, lastSyncedAt: now });
        await CalendarConnection.create({ userId: ownerId, status: 'connected', version: 1, encryptedAccessToken: null, encryptedRefreshToken: null, expiresAt: 0 });
        const occurrence = await cm.userScheduleManager.createManual({ userId: ownerId, title: 'Imported', plannedAt: now + 60_000, timezone: 'UTC' });
        await PersonalSchedule.update({ sourceId: source.id }, { where: { id: occurrence.scheduleId } });
        expect((await client.get('/api/personalToday')).body.schedules).toHaveLength(1);
        await source.update({ enabled: false });
        expect((await client.get('/api/personalToday')).body.schedules).toEqual([]);
        const path = `/api/personalToday/schedules/${occurrence.id}`;
        expectConflict(await patch(client, path, { action: 'snooze', version: 0, minutes: 60 }));
        await source.update({ enabled: true });
        await CalendarConnection.update({ status: 'disconnected' }, { where: { userId: ownerId } });
        expect((await client.get('/api/personalToday')).body.schedules).toEqual([]);
        expectConflict(await patch(client, path, { action: 'snooze', version: 0, minutes: 60 }));
    });
    it('requires CSRF for browser mutations and returns localized conflict errors', async () => {
        const client = givenAuthenticatedClient(app, { discordId: ownerId });
        const task = await newTask();
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try { expectForbidden(await patch(client, `/api/personalToday/tasks/${task.id}`, { action: 'done', version: 0 })); }
        finally { vi.unstubAllEnvs(); }
        const conflict = await client.raw.patch(`/api/personalToday/tasks/${task.id}`).set('Authorization', `Bearer ${client.token}`).set('Accept-Language', 'nl').send({ action: 'done', version: 99 });
        expectConflict(conflict);
        expect(conflict.body.error.message).toContain('Vernieuw Vandaag');
        expect((await cm.userTaskManager.get(task.id, ownerId))?.state).toBe('active');
    });
});
