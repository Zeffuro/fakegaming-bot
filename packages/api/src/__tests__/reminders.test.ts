import request from 'supertest';
import app from '../app.js';
import {configManager} from '../jest.setup.js';
import {signTestJwt} from '../testUtils/jwt.js';

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
    await configManager.reminderManager.remove({});
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
});
