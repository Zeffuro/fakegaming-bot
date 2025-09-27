import request from 'supertest';
import app from '../app.js';
import {signTestJwt} from '../testUtils/jwt.js';

const testUser = {
    discordId: 'testuser1',
    timezone: 'Europe/Amsterdam',
    defaultReminderTimeSpan: '1h'
};

describe('Users API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt();
    });
    it('should create or update a user', async () => {
        const res = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send(testUser);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
    it('should list all users', async () => {
        const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a user by discordId', async () => {
        const res = await request(app).get(`/api/users/${testUser.discordId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.discordId).toBe(testUser.discordId);
    });
    it('should set timezone for a user', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.discordId}/timezone`)
            .set('Authorization', `Bearer ${token}`)
            .send({timezone: 'Europe/Berlin'});
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('should set default reminder timespan for a user', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.discordId}/defaultReminderTimeSpan`)
            .set('Authorization', `Bearer ${token}`)
            .send({timespan: '2h'});
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('should return 404 for non-existent user', async () => {
        const res = await request(app).get('/api/users/nonexistentuser').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});
