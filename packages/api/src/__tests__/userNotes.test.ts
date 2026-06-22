import { beforeEach, describe, expect, it } from 'vitest';
import { expectBadRequest, expectCreated, expectNotFound, expectOk, expectUnauthorized, givenAuthenticatedClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';

describe('User notes API', () => {
    beforeEach(async () => {
        await configManager.userNoteManager.removeAll();
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
});
