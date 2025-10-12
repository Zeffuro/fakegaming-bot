import { describe, it, expect } from 'vitest';
import app from '../app.js';
import { expectOk, expectCreated, expectBadRequest, expectUnauthorized, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const testUser = {
    discordId: 'testuser1',
    timezone: 'Europe/Amsterdam',
    defaultReminderTimeSpan: '1h'
};

describe('Users API', () => {
    const client = givenAuthenticatedClient(app);

    it('should create or update a user', async () => {
        const res = await client.post('/api/users', testUser);
        expectCreated(res);
        expect(res.body.success).toBe(true);
    });
    it('should list all users', async () => {
        const res = await client.get('/api/users');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a user by discordId', async () => {
        const res = await client.get(`/api/users/${testUser.discordId}`);
        expectOk(res);
        expect(res.body.discordId).toBe(testUser.discordId);
    });
    it('should set timezone for a user', async () => {
        const res = await client.put(`/api/users/${testUser.discordId}/timezone`, {timezone: 'Europe/Berlin'});
        expectOk(res);
        expect(res.body.success).toBe(true);
    });
    it('should set default reminder timespan for a user', async () => {
        const res = await client.put(`/api/users/${testUser.discordId}/defaultReminderTimeSpan`, {timespan: '2h'});
        expectOk(res);
        expect(res.body.success).toBe(true);
    });
    it('should return 404 for non-existent user', async () => {
        const res = await client.get('/api/users/nonexistentuser');
        expectNotFound(res);
    });

    // Invalid body tests
    it('should return 400 when POST /api/users with missing fields', async () => {
        const res = await client.post('/api/users', {} as any);
        expectBadRequest(res);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/users/:discordId with missing body', async () => {
        // ensure user exists first
        await client.post('/api/users', testUser);
        const res = await client.put(`/api/users/${testUser.discordId}`, {} as any);
        expectBadRequest(res);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/users/:discordId/timezone with invalid body', async () => {
        const res = await client.put(`/api/users/${testUser.discordId}/timezone`, { timezone: '' });
        expectBadRequest(res);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/users/:discordId/defaultReminderTimeSpan with invalid body', async () => {
        const res = await client.put(`/api/users/${testUser.discordId}/defaultReminderTimeSpan`, { timespan: '' });
        expectBadRequest(res);
        expect(res.body.error).toBe('Body validation failed');
    });

    // 401 unauthorized coverage
    it('should return 401 for GET /api/users without JWT', async () => {
        const res = await client.raw.get('/api/users');
        expectUnauthorized(res);
    });
    it('should return 401 for POST /api/users without JWT', async () => {
        const res = await client.raw.post('/api/users').send(testUser);
        expectUnauthorized(res);
    });
    it('should return 401 for PUT /api/users/:discordId without JWT', async () => {
        const res = await client.raw.put(`/api/users/${testUser.discordId}`).send({ timezone: 'UTC' });
        expectUnauthorized(res);
    });
    it('should return 401 for DELETE /api/users/:discordId without JWT', async () => {
        const res = await client.raw.delete(`/api/users/${testUser.discordId}`);
        expectUnauthorized(res);
    });
});
