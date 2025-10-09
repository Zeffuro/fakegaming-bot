import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';

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
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all servers', async () => {
        const res = await request(app).get('/api/servers').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get a server by serverId', async () => {
        const res = await request(app).get(`/api/servers/${testServer.serverId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.serverId).toBe(testServer.serverId);
    });

    it('should return 404 for non-existent server', async () => {
        const res = await request(app).get('/api/servers/nonexistentserver').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should return 400 when POST /api/servers with missing fields', async () => {
        const res = await request(app)
            .post('/api/servers')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/servers/:serverId with invalid body', async () => {
        const res = await request(app)
            .put(`/api/servers/${testServer.serverId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ prefix: 123 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Body validation failed');
    });
});
