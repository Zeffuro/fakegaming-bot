import { beforeEach, describe, expect, it } from 'vitest';
import { expectBadRequest, expectCreated, expectNotFound, expectOk, expectUnauthorized, givenAuthenticatedClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';

describe('User reminders API', () => {
    beforeEach(async () => {
        await configManager.reminderManager.removeAll();
    });

    it('creates, lists, snoozes, and deletes reminders for the authenticated user', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'reminder-user' });

        const created = await client.post('/api/userReminders', {
            message: 'Check deployment',
            timespan: '1h',
        });
        expectCreated(created);
        expect(created.body).toMatchObject({
            userId: 'reminder-user',
            message: 'Check deployment',
            timespan: '1h',
            completed: false,
        });
        expect(created.body.timestamp).toBeGreaterThan(Date.now());

        const listed = await client.get('/api/userReminders');
        expectOk(listed);
        expect(listed.body.reminders).toHaveLength(1);
        expect(listed.body.reminders[0]).toMatchObject({ id: created.body.id });

        const snoozed = await client.raw
            .patch(`/api/userReminders/${created.body.id}/snooze`)
            .set('Authorization', `Bearer ${client.token}`)
            .send({ timespan: '2h' });
        expectOk(snoozed);
        expect(snoozed.body).toMatchObject({
            id: created.body.id,
            timespan: '2h',
        });
        expect(snoozed.body.timestamp).toBeGreaterThan(created.body.timestamp);

        const deleted = await client.delete(`/api/userReminders/${created.body.id}`);
        expectOk(deleted);
        expect(deleted.body.success).toBe(true);

        expectNotFound(await client.get(`/api/userReminders/${created.body.id}`));
    });

    it('does not expose reminders across users', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'owner-user' });
        const other = givenAuthenticatedClient(app, { discordId: 'other-user' });

        const created = await owner.post('/api/userReminders', {
            message: 'Private reminder',
            timespan: '30m',
        });
        expectCreated(created);

        const otherList = await other.get('/api/userReminders');
        expectOk(otherList);
        expect(otherList.body.reminders).toEqual([]);

        expectNotFound(await other.get(`/api/userReminders/${created.body.id}`));
        expectNotFound(await other.raw
            .patch(`/api/userReminders/${created.body.id}/snooze`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({ timespan: '1h' }));
        expectNotFound(await other.delete(`/api/userReminders/${created.body.id}`));
    });

    it('validates timespans and requires authentication', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'reminder-user' });

        expectBadRequest(await client.post('/api/userReminders', {
            message: 'Invalid',
            timespan: 'not a time',
        }));
        expectBadRequest(await client.post('/api/userReminders', {
            message: '',
            timespan: '1h',
        }));

        const noAuth = await client.raw.get('/api/userReminders');
        expectUnauthorized(noAuth);
    });
});
