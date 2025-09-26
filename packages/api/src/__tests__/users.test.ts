import request from 'supertest';
import app from '../app.js';

const testUser = {
    discordId: 'testuser1',
    timezone: 'Europe/Amsterdam',
    defaultReminderTimeSpan: '1h'
};

describe('Users API', () => {
    it('should create or update a user', async () => {
        const res = await request(app).post('/api/users').send(testUser);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('should list all users', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get a user by discordId', async () => {
        const res = await request(app).get(`/api/users/${testUser.discordId}`);
        expect(res.status).toBe(200);
        expect(res.body.discordId).toBe(testUser.discordId);
    });

    it('should set timezone for a user', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.discordId}/timezone`)
            .send({timezone: 'Europe/Berlin'});
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should set default reminder timespan for a user', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.discordId}/defaultReminderTimeSpan`)
            .send({timespan: '2h'});
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent user', async () => {
        const res = await request(app).get('/api/users/nonexistentuser');
        expect(res.status).toBe(404);
    });
});

