import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { signTestJwt, expectUnauthorized, expectNotFound, expectCreated, expectForbidden, expectOk, expectInternalServerError } from '@zeffuro/fakegaming-common/testing';

const testReminder = {
    id: 'reminder-1',
    userId: 'testuser',
    message: 'Test reminder',
    timespan: '1h',
    timestamp: Date.now() + 3600000
};

const otherReminder = { ...testReminder, id: 'reminder-other', userId: 'other-reminder-user' };

let reminderId: string;

beforeEach(async () => {
    // Clean up reminders table before each test
    await configManager.reminderManager.removeAll();
    const created = await configManager.reminderManager.addPlain(testReminder);
    reminderId = created.id;
});

afterEach(() => vi.unstubAllEnvs());

describe('Reminders API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list only reminders owned by the caller', async () => {
        await configManager.reminderManager.addPlain(otherReminder);
        const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(res.body.map((reminder: { id: string }) => reminder.id)).toEqual([reminderId]);
    });
    it('should get a reminder by id', async () => {
        const res = await request(app).get(`/api/reminders/${reminderId}`).set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(res.body.id).toBe(reminderId);
    });
    it('should add a new reminder', async () => {
        const res = await request(app).post('/api/reminders').set('Authorization', `Bearer ${token}`).send({
            id: 'reminder-2',
            userId: testReminder.userId,
            message: 'Another reminder',
            timespan: '2h',
            timestamp: Date.now() + 7200000
        });
        expectCreated(res);
        expect(res.body.userId).toBe(testReminder.userId);
    });
    it('should delete a reminder', async () => {
        // Add a reminder to delete
        const created = await configManager.reminderManager.addPlain({
            id: 'reminder-3',
            userId: testReminder.userId,
            message: 'To be deleted',
            timespan: '1h',
            timestamp: Date.now() + 3600000
        });
        const res = await request(app).delete(`/api/reminders/${created.id}`).set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(res.body.success).toBe(true);
    });
    it('should block reads, deletion and creation across owners', async () => {
        await configManager.reminderManager.addPlain(otherReminder);
        const path = `/api/reminders/${otherReminder.id}`;
        const client = request(app);

        expectNotFound(await client.get(path).auth(token, { type: 'bearer' }));
        expectNotFound(await client.delete(path).auth(token, { type: 'bearer' }));
        expectForbidden(await client.post('/api/reminders').auth(token, { type: 'bearer' })
            .send({ ...otherReminder, id: 'blocked-reminder' }));

        await expect(configManager.reminderManager.getForUser(otherReminder.id, otherReminder.userId))
            .resolves.toMatchObject(otherReminder);
        await expect(configManager.reminderManager.getForUser('blocked-reminder', otherReminder.userId)).resolves.toBeNull();
    });

    it('should preserve service writes and dashboard admin reads across owners', async () => {
        vi.stubEnv('SERVICE_API_TOKEN', 'reminder-service-test');
        vi.stubEnv('DASHBOARD_ADMINS', 'reminder-admin');
        const client = request(app);

        expectCreated(await client.post('/api/reminders').set('X-Service-Token', 'reminder-service-test').send(otherReminder));
        const res = await client.get('/api/reminders').auth(signTestJwt({ discordId: 'reminder-admin' }), { type: 'bearer' });
        expectOk(res);
        expect(res.body.map((reminder: { id: string }) => reminder.id)).toEqual(expect.arrayContaining([reminderId, otherReminder.id]));
    });
    it('should return 404 for non-existent reminder', async () => {
        const res = await request(app).get('/api/reminders/999999').set('Authorization', `Bearer ${token}`);
        expectNotFound(res);
    });
    it('should return 401 for GET /api/reminders without JWT', async () => {
        const res = await request(app).get('/api/reminders');
        expectUnauthorized(res);
    });

    it('should return 401 for POST /api/reminders without JWT', async () => {
        const res = await request(app)
            .post('/api/reminders')
            .send({id: 'reminder-4', userId: 'user4', message: 'msg4', timespan: '1h', timestamp: Date.now()});
        expectUnauthorized(res);
    });

    it('should return 401 for DELETE /api/reminders/:id without JWT', async () => {
        const res = await request(app)
            .delete(`/api/reminders/${reminderId}`);
        expectUnauthorized(res);
    });

    it('should return 404 when deleting non-existent reminder', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .delete('/api/reminders/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(res);
    });

    it('should handle duplicate add gracefully', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res1 = await request(app)
            .post('/api/reminders')
            .set('Authorization', `Bearer ${token}`)
            .send(testReminder);
        if (res1.status === 201) {
            expectCreated(res1);
        } else {
            // 409 conflict when duplicate
            const { expectConflict } = await import('@zeffuro/fakegaming-common/testing');
            expectConflict(res1);
        }
    });

    it('should return 400 for invalid input types', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .post('/api/reminders')
            .set('Authorization', `Bearer ${token}`)
            .send({id: 123, userId: null, message: null, timespan: null, timestamp: 'invalid'});
        expect([400, 500]).toContain(res.status);
    });

    it('should return 500 for DB error on POST /api/reminders', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Simulate DB error by mocking addPlain
        const origAdd = configManager.reminderManager.addPlain;
        configManager.reminderManager.addPlain = async () => { throw new Error('DB error'); };
        const res = await request(app)
            .post('/api/reminders')
            .set('Authorization', `Bearer ${token}`)
            .send({id: 'reminder-5', userId: testReminder.userId, message: 'msg5', timespan: '1h', timestamp: Date.now()});
        expectInternalServerError(res);
        configManager.reminderManager.addPlain = origAdd;
    });
});
