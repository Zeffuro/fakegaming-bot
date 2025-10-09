import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';

const testUser = {
    discordId: 'testuser1',
    timezone: 'Europe/Amsterdam',
    defaultReminderTimeSpan: '1h'
};

describe('Users API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
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

    // Invalid body tests
    it('should return 400 when POST /api/users with missing fields', async () => {
        const res = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/users/:discordId with missing body', async () => {
        // ensure user exists first
        await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send(testUser);
        const res = await request(app)
            .put(`/api/users/${testUser.discordId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/users/:discordId/timezone with invalid body', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.discordId}/timezone`)
            .set('Authorization', `Bearer ${token}`)
            .send({ timezone: '' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/users/:discordId/defaultReminderTimeSpan with invalid body', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.discordId}/defaultReminderTimeSpan`)
            .set('Authorization', `Bearer ${token}`)
            .send({ timespan: '' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Body validation failed');
    });

    // 401 unauthorized coverage
    it('should return 401 for GET /api/users without JWT', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(401);
    });
    it('should return 401 for POST /api/users without JWT', async () => {
        const res = await request(app).post('/api/users').send(testUser);
        expect(res.status).toBe(401);
    });
    it('should return 401 for PUT /api/users/:discordId without JWT', async () => {
        const res = await request(app).put(`/api/users/${testUser.discordId}`).send({ timezone: 'UTC' });
        expect(res.status).toBe(401);
    });
    it('should return 401 for DELETE /api/users/:discordId without JWT', async () => {
        const res = await request(app).delete(`/api/users/${testUser.discordId}`);
        expect(res.status).toBe(401);
    });
});
