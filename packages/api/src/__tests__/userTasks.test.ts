import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserTask, ReminderDelivery } from '@zeffuro/fakegaming-common/models';
import { givenAuthenticatedClient, expectOk, expectNotFound, expectBadRequest, expectUnauthorized, expectConflict, expectForbidden, type AuthClient } from '@zeffuro/fakegaming-common/testing';
import { UserTaskManager } from '@zeffuro/fakegaming-common/managers';
import app from '../app.js';
import { configManager as cm } from '../vitest.setup.js';

const owner = 'task-editor-owner';
const now = Date.UTC(2026, 9, 9, 10);
const original = cm.userTaskManager;
const patch = (client: AuthClient, id: string, body: object) => client.raw.patch(`/api/userTasks/${id}`).set('Authorization', `Bearer ${client.token}`).send(body);
const edit = { version: 0, title: 'Edited', checklist: [{ text: 'Finished item', done: true }], timezone: 'Europe/Amsterdam' };

describe('owner task editor API', () => {
    beforeEach(async () => {
        vi.spyOn(Date, 'now').mockReturnValue(now);
        cm.userTaskManager = new UserTaskManager(() => now);
        await ReminderDelivery.destroy({ where: {} });
        await UserTask.destroy({ where: {} });
        await cm.reminderManager.removeAll();
        await cm.userManager.removeAll();
        await cm.userManager.setUser({ discordId: owner, timezone: 'Europe/Amsterdam' });
    });
    afterEach(() => { cm.userTaskManager = original; });
    const create = () => cm.userTaskManager.create({ userId: owner, title: 'Future task', timezone: 'Europe/Amsterdam', dueAt: now + 7 * 86_400_000 });

    it('lists all future active tasks and read-only completed history privately', async () => {
        const client = givenAuthenticatedClient(app, { discordId: owner });
        const active = await create();
        const complete = await create();
        await cm.userTaskManager.done(complete.id, owner, 0);
        await cm.userTaskManager.create({ userId: 'other', title: 'Foreign', timezone: 'UTC' });
        const result = await client.get('/api/userTasks');
        expectOk(result);
        expect(result.headers['cache-control']).toBe('private, no-store');
        expect(result.body.active.map((task: { id: string }) => task.id)).toEqual([active.id]);
        expect(result.body.completed.map((task: { id: string }) => task.id)).toEqual([complete.id]);
        expect(result.body.timezone).toBe('Europe/Amsterdam');
        expectUnauthorized(await client.raw.get('/api/userTasks'));
        expectBadRequest(await client.get('/api/userTasks?userId=other'));
        vi.stubEnv('SERVICE_API_TOKEN', 'task-editor-service-test');
        try {
            expectUnauthorized(await client.raw.get('/api/userTasks').set('X-Service-Token', 'task-editor-service-test'));
            expectUnauthorized(await client.raw.patch(`/api/userTasks/${active.id}`).set('X-Service-Token', 'task-editor-service-test').send(edit));
        } finally { vi.unstubAllEnvs(); }
    });

    it('guards ownership, version, strict body and saved timezone, then changes exact due and clears it', async () => {
        const client = givenAuthenticatedClient(app, { discordId: owner });
        const task = await create();
        expectNotFound(await patch(givenAuthenticatedClient(app, { discordId: 'other' }), task.id, { ...edit, timezone: 'UTC' }));
        expectBadRequest(await patch(client, task.id, { ...edit, timezone: 'UTC' }));
        expectBadRequest(await patch(client, task.id, { ...edit, userId: 'other' }));
        expectBadRequest(await patch(client, task.id, { ...edit, checklist: [{ text: 'Item', done: 'true' }] }));
        expectBadRequest(await patch(client, task.id, { ...edit, due: 'tomorrow' }));
        expectBadRequest(await patch(client, task.id, { ...edit, due: '2026-10-08T12:00' }));
        const changed = await patch(client, task.id, { ...edit, due: '2026-10-23T12:30' });
        expectOk(changed);
        expect(changed.body).toMatchObject({ title: 'Edited', version: 1, dueAt: Date.parse('2026-10-23T10:30:00Z'), checklist: edit.checklist });
        expectConflict(await patch(client, task.id, edit));
        const cleared = await patch(client, task.id, { ...edit, version: 1, due: null });
        expectOk(cleared); expect(cleared.body).toMatchObject({ dueAt: null, reminderId: null });
        await cm.userTaskManager.done(task.id, owner, 2);
        expectConflict(await patch(client, task.id, { ...edit, version: 3 }));
    });

    it('preserves an omitted overdue deadline and enforces browser CSRF with localized conflicts', async () => {
        const client = givenAuthenticatedClient(app, { discordId: owner });
        const task = await create();
        await UserTask.update({ dueAt: now - 60_000 }, { where: { id: task.id } });
        const changed = await patch(client, task.id, edit);
        expectOk(changed); expect(changed.body.dueAt).toBe(now - 60_000);
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try { expectForbidden(await patch(client, task.id, { ...edit, version: 1 })); }
        finally { vi.unstubAllEnvs(); }
        const conflict = await client.raw.patch(`/api/userTasks/${task.id}`).set('Authorization', `Bearer ${client.token}`).set('Accept-Language', 'nl').send(edit);
        expectConflict(conflict); expect(conflict.body.error.message).toContain('Vernieuw je taken');
    });
});
