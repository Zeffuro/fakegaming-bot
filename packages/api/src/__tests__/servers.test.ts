import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { CACHE_KEYS, CACHE_TTL, defaultCacheManager } from '@zeffuro/fakegaming-common';
import { expectOk, expectCreated, expectBadRequest, expectForbidden, expectUnauthorized, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const testServer = {
    serverId: 'testserver1',
    name: 'Test Server',
    prefix: '!'
};
const memberServer = { serverId: 'testserver-member', prefix: '?' };

beforeAll(async () => {
    // Insert a test server for retrieval
    await configManager.serverManager.add(testServer);
    await configManager.serverManager.add(memberServer);
});

beforeEach(async () => {
    await defaultCacheManager.set(CACHE_KEYS.userGuilds('testuser'), [
        { id: testServer.serverId, permissions: '8' },
        { id: memberServer.serverId, permissions: '0' },
        { id: 'nonexistentserver', owner: true },
        { id: 'todeleteserver', owner: true },
        { id: 'testserver-create', owner: true },
    ], CACHE_TTL.USER_GUILDS);
});

afterEach(() => vi.unstubAllEnvs());

describe('Servers API', () => {
    const client = givenAuthenticatedClient(app);

    it('should list only servers the caller can administer', async () => {
        const res = await client.get('/api/servers');
        expectOk(res);
        expect(res.body.map((server: { serverId: string }) => server.serverId)).toEqual([testServer.serverId]);
    });

    it('should get a server by serverId', async () => {
        const res = await client.get(`/api/servers/${testServer.serverId}`);
        expectOk(res);
        expect(res.body.serverId).toBe(testServer.serverId);
    });

    it('should return 404 for non-existent server', async () => {
        const res = await client.get('/api/servers/nonexistentserver');
        expectNotFound(res);
    });

    it('should let guild owners create and update their server config', async () => {
        const serverId = 'testserver-create';
        expectCreated(await client.post('/api/servers', { serverId, prefix: '!' }));
        const res = await client.put(`/api/servers/${serverId}`, { prefix: '?' });
        expectOk(res);
        expect(res.body).toMatchObject({ serverId, prefix: '?' });
    });

    it('should forbid reads and writes for guilds the caller cannot administer', async () => {
        const path = `/api/servers/${memberServer.serverId}`;
        const missing = { serverId: 'testserver-unrelated', prefix: '!' };

        expectForbidden(await client.get(path));
        expectForbidden(await client.post('/api/servers', missing));
        expectForbidden(await client.put(path, { prefix: '!' }));
        expectForbidden(await client.delete(path));

        await expect(configManager.serverManager.getOnePlain({ serverId: memberServer.serverId })).resolves.toMatchObject(memberServer);
        await expect(configManager.serverManager.getOnePlain({ serverId: missing.serverId })).resolves.toBeNull();
    });

    it('should preserve dashboard admin and service access across guilds', async () => {
        vi.stubEnv('DASHBOARD_ADMINS', 'servers-admin');
        vi.stubEnv('SERVICE_API_TOKEN', 'servers-service-test');
        const admin = givenAuthenticatedClient(app, { discordId: 'servers-admin' });
        const server = { serverId: 'service-managed-server', prefix: '!' };

        expectCreated(await client.raw.post('/api/servers').set('X-Service-Token', 'servers-service-test').send(server));
        const res = await admin.get('/api/servers');
        expectOk(res);
        expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining(server)]));
    });

    it('should return 400 when POST /api/servers with missing fields', async () => {
        const res = await client.post('/api/servers', {});
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/servers/:serverId with invalid body', async () => {
        const res = await client.put(`/api/servers/${testServer.serverId}`, { prefix: 123 as any });
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('should return 401 for POST /api/servers without JWT', async () => {
        const res = await client.raw.post('/api/servers').send({ serverId: 'srv-nojwt', name: 'No JWT' });
        expectUnauthorized(res);
    });

    it('should return 401 for PUT /api/servers/:serverId without JWT', async () => {
        const res = await client.raw.put(`/api/servers/${testServer.serverId}`).send({ name: 'Updated' });
        expectUnauthorized(res);
    });

    it('should return 401 for DELETE /api/servers/:serverId without JWT', async () => {
        const res = await client.raw.delete(`/api/servers/${testServer.serverId}`);
        expectUnauthorized(res);
    });

    it('should delete a server by serverId', async () => {
        // create a server to delete
        await configManager.serverManager.add({ serverId: 'todeleteserver', name: 'Del', prefix: '!' });
        const res = await client.delete('/api/servers/todeleteserver');
        expectOk(res);
        expect(res.body.success).toBe(true);
    });
});
