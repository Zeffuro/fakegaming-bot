import { describe, it, expect, beforeAll } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectOk, expectBadRequest, expectUnauthorized, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const testServer = {
    serverId: 'testserver1',
    name: 'Test Server',
    prefix: '!'
};

beforeAll(async () => {
    // Insert a test server for retrieval
    await configManager.serverManager.add(testServer);
});

describe('Servers API', () => {
    const client = givenAuthenticatedClient(app);

    it('should list all servers', async () => {
        const res = await client.get('/api/servers');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
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

    it('should return 400 when POST /api/servers with missing fields', async () => {
        const res = await client.post('/api/servers', {});
        expectBadRequest(res);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/servers/:serverId with invalid body', async () => {
        const res = await client.put(`/api/servers/${testServer.serverId}`, { prefix: 123 as any });
        expectBadRequest(res);
        expect(res.body.error).toBe('Body validation failed');
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
