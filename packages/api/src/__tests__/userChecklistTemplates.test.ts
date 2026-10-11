import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserChecklistTemplate, UserTask, ReminderConfig } from '@zeffuro/fakegaming-common/models';
import { givenAuthenticatedClient, expectOk, expectCreated, expectNotFound, expectBadRequest, expectUnauthorized, expectConflict, expectForbidden, type AuthClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
import { configManager as cm } from '../vitest.setup.js';

const ownerId = 'checklist-owner';
const send = (client: AuthClient, method: 'patch' | 'delete', path: string, body: object) => client.raw[method](path).set('Authorization', `Bearer ${client.token}`).send(body);
beforeEach(async () => {
    await UserChecklistTemplate.destroy({ where: {} }); await UserTask.destroy({ where: {} }); await ReminderConfig.destroy({ where: {} });
    await cm.userManager.setUser({ discordId: ownerId, timezone: 'Europe/Amsterdam' });
});
describe('owner reusable checklist API', () => {
    it('creates, edits, starts independent unchecked copies and removes only the template', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId });
        const saved = await owner.post('/api/userChecklistTemplates', { title: 'Packing', items: ['Passport', 'Charger'] });
        expectCreated(saved); const path = `/api/userChecklistTemplates/${saved.body.id}`;
        const first = await owner.post(`${path}/start`, { version: 0 }); expectCreated(first);
        expect(first.body.checklist).toEqual([{ text: 'Passport', done: false }, { text: 'Charger', done: false }]);
        await cm.userTaskManager.check(first.body.id, ownerId, 0, 0);
        expectOk(await send(owner, 'patch', path, { version: 0, title: 'Travel', items: ['Passport', 'Tickets'] }));
        const second = await owner.post(`${path}/start`, { version: 1, timezone: 'Europe/Amsterdam', due: '2027-01-12T09:30' }); expectCreated(second);
        expect(second.body.id).not.toBe(first.body.id);
        expect(second.body.dueAt).toBe(Date.parse('2027-01-12T08:30:00Z'));
        expect(second.body.checklist).toEqual([{ text: 'Passport', done: false }, { text: 'Tickets', done: false }]);
        expect((await cm.userTaskManager.get(first.body.id, ownerId))?.checklist[0]?.done).toBe(true);
        expectOk(await send(owner, 'delete', path, { version: 1 }));
        expect(await cm.userTaskManager.get(second.body.id, ownerId)).not.toBeNull();
        expect((await owner.get('/api/userChecklistTemplates')).body).toEqual([]);
    });
    it('rejects other owners, stale versions, invalid dates and timezone preference changes', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId }); const other = givenAuthenticatedClient(app, { discordId: 'other' });
        const saved = await owner.post('/api/userChecklistTemplates', { title: 'Setup', items: ['Mic'] }); const path = `/api/userChecklistTemplates/${saved.body.id}`;
        expect((await other.get('/api/userChecklistTemplates')).body).toEqual([]);
        expectNotFound(await other.post(`${path}/start`, { version: 0 }));
        expectNotFound(await send(other, 'patch', path, { version: 0, title: 'Other', items: ['A'] }));
        expectNotFound(await send(other, 'delete', path, { version: 0 }));
        expectConflict(await owner.post(`${path}/start`, { version: 99 }));
        expectConflict(await owner.post(`${path}/start`, { version: 0, timezone: 'UTC' }));
        for (const due of ['1h', '2027-02-30T09:30', '2020-01-01T10:00']) expectBadRequest(await owner.post(`${path}/start`, { version: 0, due }));
        expect(await UserTask.count()).toBe(0);
        expectBadRequest(await owner.post('/api/userChecklistTemplates', { title: 'Empty', items: [] }));
        expectBadRequest(await owner.get('/api/userChecklistTemplates?userId=other'));
    });
    it('requires owner authentication and CSRF and returns localized conflicts', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId });
        expectUnauthorized(await owner.raw.get('/api/userChecklistTemplates'));
        vi.stubEnv('SERVICE_API_TOKEN', 'checklist-service-test');
        try { expectUnauthorized(await owner.raw.get('/api/userChecklistTemplates').set('X-Service-Token', 'checklist-service-test')); }
        finally { vi.unstubAllEnvs(); }
        const saved = await owner.post('/api/userChecklistTemplates', { title: 'Setup', items: ['Mic'] });
        const path = `/api/userChecklistTemplates/${saved.body.id}`;
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try { expectForbidden(await send(owner, 'delete', path, { version: 0 })); } finally { vi.unstubAllEnvs(); }
        const stale = await owner.raw.patch(path).set('Authorization', `Bearer ${owner.token}`).set('Accept-Language', 'nl').send({ version: 5, title: 'Test', items: ['Mic'] });
        expectConflict(stale); expect(stale.body.error.message).toContain('Vernieuw');
        const list = await owner.get('/api/userChecklistTemplates'); expectOk(list); expect(list.headers['cache-control']).toBe('private, no-store');
    });
});
