import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';

const testTwitch = {
    twitchUsername: 'teststreamer',
    discordChannelId: 'testchannel1',
    guildId: 'testguild1'
};

beforeEach(async () => {
    // Clean up twitch table before each test
    await configManager.twitchManager.removeAll();
    await configManager.twitchManager.add(testTwitch);
});

describe('Twitch API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all twitch configs', async () => {
        const res = await request(app).get('/api/twitch').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a twitch config by id', async () => {
        // Find the id of the inserted config
        const all = await configManager.twitchManager.getMany({
            twitchUsername: testTwitch.twitchUsername,
            discordChannelId: testTwitch.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await request(app).get(`/api/twitch/${id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.twitchUsername).toBe(testTwitch.twitchUsername);
    });
    it('should add a new twitch config', async () => {
        const res = await request(app).post('/api/twitch').set('Authorization', `Bearer ${token}`).send({
            twitchUsername: 'anotherstreamer',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
    it('should check if a stream exists', async () => {
        const res = await request(app).get('/api/twitch/exists').set('Authorization', `Bearer ${token}`)
            .query({twitchUsername: testTwitch.twitchUsername, discordChannelId: testTwitch.discordChannelId, guildId: testTwitch.guildId});
        expect(res.status).toBe(200);
        expect(res.body.exists).toBe(true);
    });
    it('should return false for non-existent stream', async () => {
        const res = await request(app).get('/api/twitch/exists').set('Authorization', `Bearer ${token}`)
            .query({twitchUsername: 'nonexistent', discordChannelId: 'nonexistent', guildId: 'testguild1'});
        expect(res.status).toBe(200);
        expect(res.body.exists).toBe(false);
    });
    it('should return 404 for non-existent twitch config', async () => {
        const res = await request(app).get('/api/twitch/999999').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should delete a twitch config', async () => {
        const all = await configManager.twitchManager.getMany({
            twitchUsername: testTwitch.twitchUsername,
            discordChannelId: testTwitch.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();

        const res = await request(app)
            .delete(`/api/twitch/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 when deleting non-existent twitch config', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).delete('/api/twitch/999999').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should return 400 when POST /api/twitch with missing fields', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).post('/api/twitch').set('Authorization', `Bearer ${token}`).send({});
        expect(res.status).toBe(400);
    });

    it('should return 401 for POST /api/twitch without JWT', async () => {
        const res = await request(app).post('/api/twitch').send({
            twitchUsername: 'anotherstreamer',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expect(res.status).toBe(401);
    });

    it('should return 403 for POST /api/twitch as non-admin', async () => {
        const nonAdminToken = signTestJwt({ discordId: 'nonadminuser' });
        const res = await request(app).post('/api/twitch').set('Authorization', `Bearer ${nonAdminToken}`).send({
            twitchUsername: 'anotherstreamer',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expect([403, 401]).toContain(res.status);
    });

    it('should return 401 for DELETE /api/twitch/:id without JWT', async () => {
        const all = await configManager.twitchManager.getMany({
            twitchUsername: testTwitch.twitchUsername,
            discordChannelId: testTwitch.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await request(app).delete(`/api/twitch/${id}`);
        expect(res.status).toBe(401);
    });

    it('should return 403 for DELETE /api/twitch/:id as non-admin', async () => {
        const all = await configManager.twitchManager.getMany({
            twitchUsername: testTwitch.twitchUsername,
            discordChannelId: testTwitch.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const nonAdminToken = signTestJwt({ discordId: 'nonadminuser' });
        const res = await request(app).delete(`/api/twitch/${id}`).set('Authorization', `Bearer ${nonAdminToken}`);
        expect([403, 401]).toContain(res.status);
    });

    it('should return 400 for DB error on POST /api/twitch', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Simulate DB error by sending invalid data
        const res = await request(app).post('/api/twitch').set('Authorization', `Bearer ${token}`).send({
            twitchUsername: null,
            discordChannelId: null,
            guildId: null
        });
        expect(res.status).toBe(400);
    });

    it('should return 500 for DB error on DELETE /api/twitch/:id', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Simulate DB error by deleting with invalid id type
        const res = await request(app).delete('/api/twitch/invalid').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });

    it('should return 403 for ForbiddenError on POST /api/twitch', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Mock manager to throw ForbiddenError
        const origAdd = configManager.twitchManager.add;
        configManager.twitchManager.add = async () => { throw new (await import('@zeffuro/fakegaming-common')).ForbiddenError('Forbidden'); };
        const res = await request(app).post('/api/twitch').set('Authorization', `Bearer ${token}`).send({
            twitchUsername: 'streamer5',
            discordChannelId: 'chan5',
            guildId: 'guild5'
        });
        expect(res.status).toBe(403);
        configManager.twitchManager.add = origAdd;
    });

    it('should return 403 for NotFoundError on POST /api/twitch', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Mock manager to throw NotFoundError
        const origAdd = configManager.twitchManager.add;
        configManager.twitchManager.add = async () => { throw new (await import('@zeffuro/fakegaming-common')).NotFoundError('Not found'); };
        const res = await request(app).post('/api/twitch').set('Authorization', `Bearer ${token}`).send({
            twitchUsername: 'streamer6',
            discordChannelId: 'chan6',
            guildId: 'guild6'
        });
        expect(res.status).toBe(403);
        configManager.twitchManager.add = origAdd;
    });

    it('should return 403 for ForbiddenError on DELETE /api/twitch/:id', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const all = await configManager.twitchManager.getMany({ twitchUsername: testTwitch.twitchUsername });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        // Mock manager to throw ForbiddenError
        const origRemove = configManager.twitchManager.remove;
        configManager.twitchManager.remove = async () => { throw new (await import('@zeffuro/fakegaming-common')).ForbiddenError('Forbidden'); };
        const res = await request(app).delete(`/api/twitch/${id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        configManager.twitchManager.remove = origRemove;
    });

    it('should return 404 for NotFoundError on DELETE /api/twitch/:id', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const all = await configManager.twitchManager.getMany({ twitchUsername: testTwitch.twitchUsername });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        // Mock manager to throw NotFoundError
        const origRemove = configManager.twitchManager.remove;
        configManager.twitchManager.remove = async () => { throw new (await import('@zeffuro/fakegaming-common')).NotFoundError('Not found'); };
        const res = await request(app).delete(`/api/twitch/${id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        configManager.twitchManager.remove = origRemove;
    });
});
