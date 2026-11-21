import { afterEach, describe, it, expect, vi } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectOk, expectCreated, expectBadRequest, expectForbidden, expectUnauthorized, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const testUser = {
    discordId: 'testuser1',
    timezone: 'Europe/Amsterdam',
    defaultReminderTimeSpan: '1h'
};
const otherUser = { ...testUser, discordId: 'other-test-user' };

afterEach(() => vi.unstubAllEnvs());

describe('Users API', () => {
    const client = givenAuthenticatedClient(app, { discordId: testUser.discordId });

    it('should create or update a user', async () => {
        const res = await client.post('/api/users', testUser);
        expectCreated(res);
        expect(res.body.success).toBe(true);
    });
    it('should list only the caller', async () => {
        await configManager.userManager.addPlain(otherUser);
        const res = await client.get('/api/users');
        expectOk(res);
        expect(res.body).toEqual([expect.objectContaining({ discordId: testUser.discordId })]);
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
        const missingUser = givenAuthenticatedClient(app, { discordId: 'nonexistentuser' });
        const res = await missingUser.get('/api/users/nonexistentuser');
        expectNotFound(res);
    });

    it('should forbid cross-account reads, creation, settings changes and deletion', async () => {
        const target = { ...otherUser, discordId: 'user-protected-by-owner' };
        await configManager.userManager.addPlain(target);
        const path = `/api/users/${target.discordId}`;
        const missing = { ...target, discordId: 'different-user' };

        expectForbidden(await client.get(path));
        expectForbidden(await client.post('/api/users', missing));
        expectForbidden(await client.put(path, { timezone: 'UTC' }));
        expectForbidden(await client.put(`${path}/timezone`, { timezone: 'UTC' }));
        expectForbidden(await client.put(`${path}/defaultReminderTimeSpan`, { timespan: '3h' }));
        expectForbidden(await client.delete(path));

        await expect(configManager.userManager.getOnePlain({ discordId: target.discordId })).resolves.toMatchObject(target);
        await expect(configManager.userManager.getOnePlain({ discordId: missing.discordId })).resolves.toBeNull();
    });

    it('should preserve dashboard admin and service access across accounts', async () => {
        vi.stubEnv('DASHBOARD_ADMINS', 'user-admin');
        vi.stubEnv('SERVICE_API_TOKEN', 'users-service-test');
        const admin = givenAuthenticatedClient(app, { discordId: 'user-admin' });
        const serviceUser = { ...otherUser, discordId: 'service-managed-user' };

        expectCreated(await client.raw.post('/api/users').set('X-Service-Token', 'users-service-test').send(serviceUser));
        const res = await admin.get('/api/users');
        expectOk(res);
        expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ discordId: serviceUser.discordId })]));
        expectOk(await admin.get(`/api/users/${serviceUser.discordId}`));
    });

    // Invalid body tests
    it('should return 400 when POST /api/users with missing fields', async () => {
        const res = await client.post('/api/users', {} as any);
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
        expect(Array.isArray(res.body.error.details)).toBe(true);
    });

    it('should return 400 when PUT /api/users/:discordId with missing body', async () => {
        // ensure user exists first
        await client.post('/api/users', testUser);
        const res = await client.put(`/api/users/${testUser.discordId}`, {} as any);
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/users/:discordId/timezone with invalid body', async () => {
        const res = await client.put(`/api/users/${testUser.discordId}/timezone`, { timezone: '' });
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/users/:discordId/defaultReminderTimeSpan with invalid body', async () => {
        const res = await client.put(`/api/users/${testUser.discordId}/defaultReminderTimeSpan`, { timespan: '' });
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
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
