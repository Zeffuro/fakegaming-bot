import request from 'supertest';
import app from '../app.js';
import {configManager} from '../jest.setup.js';
import {signTestJwt} from '../testUtils/jwt.js';

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
});
