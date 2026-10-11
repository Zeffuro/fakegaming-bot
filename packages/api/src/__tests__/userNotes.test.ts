import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectBadRequest, expectConflict, expectCreated, expectInternalServerError, expectNotFound, expectOk, expectUnauthorized, givenAuthenticatedClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { UserTask } from '@zeffuro/fakegaming-common/models';
import { PersonalError } from '@zeffuro/fakegaming-common/managers';

describe('User notes API', () => {
    beforeEach(async () => {
        await configManager.userNoteManager.removeAll();
        await UserTask.destroy({ where: {} });
    });

    it('converts privately with saved-zone exact time, returns the same task on retries and preserves the source after note deletion', async () => {
        const discordId = 'note-task-owner';
        await configManager.userManager.setUser({ discordId, timezone: 'Europe/Amsterdam' });
        const owner = givenAuthenticatedClient(app, { discordId });
        const other = givenAuthenticatedClient(app, { discordId: 'note-task-other' });
        const note = await owner.post('/api/userNotes', { title: 'Saved request', body: 'Original text', sourceUrl: 'https://discord.com/channels/1/2/3' });
        const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
        const body = { title: 'Send configuration', due: `${date} 12:30`, timezone: 'Europe/Amsterdam' };
        expectNotFound(await other.post(`/api/userNotes/${note.body.id}/task`, { title: body.title, due: body.due }));
        const result = await owner.post(`/api/userNotes/${note.body.id}/task`, body);
        expectCreated(result);
        expect(result.body).toMatchObject({ created: true, task: { title: body.title, sourceNoteId: note.body.id, sourceUrl: note.body.sourceUrl, timezone: body.timezone } });
        const retry = await owner.post(`/api/userNotes/${note.body.id}/task`, { ...body, title: 'Changed', due: null });
        expectOk(retry);
        expect(retry.body).toMatchObject({ created: false, task: { id: result.body.task.id, title: body.title, dueAt: result.body.task.dueAt } });
        expect((await owner.get(`/api/userNotes/${note.body.id}`)).body).toMatchObject({ title: 'Saved request', body: 'Original text', linkedTaskId: result.body.task.id });
        await owner.delete(`/api/userNotes/${note.body.id}`);
        expect(await configManager.userTaskManager.get(result.body.task.id, discordId)).toMatchObject({ sourceUrl: note.body.sourceUrl });
    });

    it('validates task title/date, refuses timezone overrides and cannot resurrect a deleted linked task', async () => {
        const discordId = 'note-task-validate';
        const client = givenAuthenticatedClient(app, { discordId });
        await configManager.userManager.setUser({ discordId, timezone: 'UTC' });
        const note = await client.post('/api/userNotes', { body: 'Saved' });
        const url = `/api/userNotes/${note.body.id}/task`;
        for (const body of [{ title: '' }, { title: 'x'.repeat(121) }, { title: 'Task', due: '1h' },
            { title: 'Task', due: '2020-01-01 10:00' }, { title: 'Task', timezone: 'Europe/Amsterdam' }, { title: 'Task', userId: 'someone' }]) {
            expectBadRequest(await client.post(url, body));
        }
        expect(await UserTask.count()).toBe(0);
        const result = await client.post(url, { title: 'Task' });
        expectCreated(result);
        await configManager.userTaskManager.remove(result.body.task.id, discordId);
        const retry = await client.raw.post(url).set('Authorization', `Bearer ${client.token}`).set('Accept-Language', 'nl').send({ title: 'Task' });
        expectConflict(retry);
        expect(retry.body.error.code).toBe('NOTE_TASK_DELETED');
        expect(retry.body.error.message).toContain('verwijderd of verlopen');
        expect(await UserTask.count()).toBe(0);
        expectUnauthorized(await client.raw.post(url).send({ title: 'Task' }));
    });

    it('returns localized capacity errors and generic responses for private database failures', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'task-failure-owner' });
        const note = await client.post('/api/userNotes', { body: 'Private note' });
        const conversion = vi.spyOn(configManager.userTaskManager, 'fromNote');
        try {
            conversion.mockRejectedValueOnce(new PersonalError('capacity'));
            const full = await client.post(`/api/userNotes/${note.body.id}/task`, { title: 'Task' });
            expectConflict(full);
            expect(full.body.error.code).toBe('CAPACITY');
            conversion.mockRejectedValueOnce(Object.assign(new Error('SECRET_SQL'), { sql: 'SECRET_QUERY', parameters: ['PRIVATE_TITLE'] }));
            const failure = await client.post(`/api/userNotes/${note.body.id}/task`, { title: 'Task' });
            expectInternalServerError(failure);
            expect(failure.body.error.message).toBe('The task could not be saved. Try again shortly.');
            expect(JSON.stringify(failure.body)).not.toMatch(/SECRET|PRIVATE/);
        } finally { conversion.mockRestore(); }
    });

    it('exposes inbox metadata and validates owner-scoped filters and state updates', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'inbox-owner' });
        const other = givenAuthenticatedClient(app, { discordId: 'inbox-other' });
        const saved = await owner.post('/api/userNotes', { body: '100% guide', tags: [' Games '], sourceUrl: 'https://example.com/' });
        expectCreated(saved);
        expect(saved.body).toMatchObject({ status: 'unread', tags: ['games'], sourceUrl: 'https://example.com/' });
        expectNotFound(await other.put(`/api/userNotes/${saved.body.id}`, { status: 'archived' }));
        const filtered = await owner.get('/api/userNotes?query=100%25&tag=games&status=unread&page=1&pageSize=5');
        expectOk(filtered);
        expect(filtered.body).toMatchObject({ total: 1, page: 1, pages: 1 });
        expect(filtered.body.notes).toHaveLength(1);
        expect((await other.get('/api/userNotes?status=all')).body.notes).toHaveLength(0);
        const archived = await owner.put(`/api/userNotes/${saved.body.id}`, { status: 'archived', tags: [] });
        expectOk(archived);
        expect(archived.body).toMatchObject({ status: 'archived', tags: [] });
        expect((await owner.get('/api/userNotes?status=active')).body.notes).toHaveLength(0);
        expect((await owner.get('/api/userNotes?status=archived')).body.notes).toHaveLength(1);
        expectBadRequest(await owner.put(`/api/userNotes/${saved.body.id}`, { sourceUrl: 'javascript:alert(1)' }));
        expectBadRequest(await owner.put(`/api/userNotes/${saved.body.id}`, { status: 'unknown' }));
        expectBadRequest(await owner.get('/api/userNotes?page=0'));
    });

    it('creates, lists, updates, and deletes notes for the authenticated user', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'note-user' });

        const created = await client.post('/api/userNotes', {
            title: 'Deploy checklist',
            body: 'Run migrations',
            pinned: true,
        });
        expectCreated(created);
        expect(created.body).toMatchObject({
            discordId: 'note-user',
            title: 'Deploy checklist',
            body: 'Run migrations',
            pinned: true,
        });

        const listed = await client.get('/api/userNotes');
        expectOk(listed);
        expect(listed.body.notes).toHaveLength(1);
        expect(listed.body.notes[0]).toMatchObject({ id: created.body.id, title: 'Deploy checklist' });

        const updated = await client.put(`/api/userNotes/${created.body.id}`, {
            title: 'Updated checklist',
            body: 'Run migrations and smoke test',
            pinned: false,
        });
        expectOk(updated);
        expect(updated.body).toMatchObject({
            title: 'Updated checklist',
            pinned: false,
        });

        const deleted = await client.delete(`/api/userNotes/${created.body.id}`);
        expectOk(deleted);
        expect(deleted.body.success).toBe(true);

        const afterDelete = await client.get(`/api/userNotes/${created.body.id}`);
        expectNotFound(afterDelete);
    });

    it('derives a title when creating notes without one', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'note-user' });

        const created = await client.post('/api/userNotes', {
            body: 'First dashboard-free note\nwith details',
        });

        expectCreated(created);
        expect(created.body).toMatchObject({
            title: 'First dashboard-free note',
            body: 'First dashboard-free note\nwith details',
        });
    });

    it('uses the stored user locale for generated fallback titles', async () => {
        const discordId = 'note-locale-user';
        await configManager.userManager.setUser({discordId, preferredLocale: 'nl'});
        const client = givenAuthenticatedClient(app, {discordId});
        const created = await client.post('/api/userNotes', {title: 'Temporary title', body: ''});
        expectCreated(created);

        const updated = await client.raw
            .put(`/api/userNotes/${created.body.id}`)
            .set('Authorization', `Bearer ${client.token}`)
            .set('Accept-Language', 'en')
            .send({title: ''});

        expectOk(updated);
        expect(updated.body.title).toBe('Naamloze notitie');
    });

    it('does not expose notes across users', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'owner-user' });
        const other = givenAuthenticatedClient(app, { discordId: 'other-user' });

        const created = await owner.post('/api/userNotes', {
            title: 'Private',
            body: 'Owner only',
        });
        expectCreated(created);

        const otherList = await other.get('/api/userNotes');
        expectOk(otherList);
        expect(otherList.body.notes).toEqual([]);

        expectNotFound(await other.get(`/api/userNotes/${created.body.id}`));
        expectNotFound(await other.put(`/api/userNotes/${created.body.id}`, { title: 'No access' }));
        expectNotFound(await other.delete(`/api/userNotes/${created.body.id}`));
    });

    it('validates note bodies and requires authentication', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'note-user' });

        const invalid = await client.post('/api/userNotes', { title: '', body: '' });
        expectBadRequest(invalid);

        const noAuth = await client.raw.get('/api/userNotes');
        expectUnauthorized(noAuth);
    });

    it('returns actionable Dutch validation and not-found messages', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'note-user' });
        const invalid = await client.raw
            .post('/api/userNotes')
            .set('Authorization', `Bearer ${client.token}`)
            .set('Accept-Language', 'nl')
            .send({ title: '', body: '' });
        expectBadRequest(invalid);
        expect(invalid.body.error.details[0]?.message).toBe('title of body is verplicht');

        const missing = await client.raw
            .get('/api/userNotes/missing')
            .set('Authorization', `Bearer ${client.token}`)
            .set('Accept-Language', 'nl');
        expectNotFound(missing);
        expect(missing.body.error.message).toBe('Notitie niet gevonden');
    });
});
