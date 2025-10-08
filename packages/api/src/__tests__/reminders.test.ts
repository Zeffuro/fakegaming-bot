import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';

const testReminder = {
    id: 'reminder-1',
    userId: 'reminderuser1',
    message: 'Test reminder',
    timespan: '1h',
    timestamp: Date.now() + 3600000
};

let reminderId: string;

beforeEach(async () => {
    // Clean up reminders table before each test
    await configManager.reminderManager.removeAll();
    const created = await configManager.reminderManager.addPlain(testReminder);
    reminderId = created.id;
});

describe('Reminders API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all reminders', async () => {
        const res = await request(app).get('/api/reminders').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a reminder by id', async () => {
        const res = await request(app).get(`/api/reminders/${reminderId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(reminderId);
    });
    it('should add a new reminder', async () => {
        const res = await request(app).post('/api/reminders').set('Authorization', `Bearer ${token}`).send({
            id: 'reminder-2',
            userId: 'reminderuser2',
            message: 'Another reminder',
            timespan: '2h',
            timestamp: Date.now() + 7200000
        });
        expect(res.status).toBe(201);
        expect(res.body.userId).toBe('reminderuser2');
    });
    it('should delete a reminder', async () => {
        // Add a reminder to delete
        const created = await configManager.reminderManager.addPlain({
            id: 'reminder-3',
            userId: 'reminderuser3',
            message: 'To be deleted',
            timespan: '1h',
            timestamp: Date.now() + 3600000
        });
        const res = await request(app).delete(`/api/reminders/${created.id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('should return 404 for non-existent reminder', async () => {
        const res = await request(app).get('/api/reminders/999999').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('should return 401 for GET /api/reminders without JWT', async () => {
        const res = await request(app).get('/api/reminders');
        expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/reminders without JWT', async () => {
        const res = await request(app)
            .post('/api/reminders')
            .send({id: 'reminder-4', userId: 'user4', message: 'msg4', timespan: '1h', timestamp: Date.now()});
        expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /api/reminders/:id without JWT', async () => {
        const res = await request(app)
            .delete(`/api/reminders/${reminderId}`);
        expect(res.status).toBe(401);
    });

    it('should return 404 when deleting non-existent reminder', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .delete('/api/reminders/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should handle duplicate add gracefully', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res1 = await request(app)
            .post('/api/reminders')
            .set('Authorization', `Bearer ${token}`)
            .send(testReminder);
        expect([201, 409]).toContain(res1.status);
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
            .send({id: 'reminder-5', userId: 'user5', message: 'msg5', timespan: '1h', timestamp: Date.now()});
        expect(res.status).toBe(500);
        configManager.reminderManager.addPlain = origAdd;
    });
});
