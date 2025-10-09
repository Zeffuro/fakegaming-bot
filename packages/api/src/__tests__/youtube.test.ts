import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';

const testYoutube = {
    youtubeChannelId: 'ytchan1',
    discordChannelId: 'ytchan1discord',
    guildId: 'testguild1'
};

beforeEach(async () => {
    await configManager.youtubeManager.removeAll();
    await configManager.youtubeManager.add(testYoutube);
});

describe('YouTube API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all youtube configs', async () => {
        const res = await request(app).get('/api/youtube').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a youtube config by id', async () => {
        const all = await configManager.youtubeManager.getMany({
            youtubeChannelId: testYoutube.youtubeChannelId,
            discordChannelId: testYoutube.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await request(app).get(`/api/youtube/${id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.youtubeChannelId).toBe(testYoutube.youtubeChannelId);
    });
    it('should add a new youtube config', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).post('/api/youtube').set('Authorization', `Bearer ${token}`).send({
            youtubeChannelId: 'ytchan2',
            discordChannelId: 'ytchan2discord',
            guildId: 'testguild2'
        });
        expect(res.status).toBe(201);
        expect(res.body.youtubeChannelId).toBe('ytchan2');
    });
    it('should upsert a youtube config', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).put('/api/youtube').set('Authorization', `Bearer ${token}`).send({
            youtubeChannelId: 'ytchan1',
            discordChannelId: 'ytchan1discord',
            guildId: 'testguild1'
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('should get a youtube config by channel', async () => {
        const res = await request(app).get('/api/youtube/channel').set('Authorization', `Bearer ${token}`)
            .query({youtubeChannelId: 'ytchan1', discordChannelId: 'ytchan1discord', guildId: 'testguild1'});
        expect(res.status).toBe(200);
        expect(res.body.youtubeChannelId).toBe('ytchan1');
    });
    it('should return 401 for GET /api/youtube/channel without JWT', async () => {
        const res = await request(app)
            .get('/api/youtube/channel')
            .query({ youtubeChannelId: 'ytchan1', discordChannelId: 'ytchan1discord', guildId: 'testguild1' });
        expect(res.status).toBe(401);
    });
    it('should return 400 for GET /api/youtube/channel with missing query', async () => {
        const res = await request(app)
            .get('/api/youtube/channel')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Query validation failed');
        expect(Array.isArray(res.body.details)).toBe(true);
    });
    it('should return 400 for GET /api/youtube/channel with empty values', async () => {
        const res = await request(app)
            .get('/api/youtube/channel')
            .set('Authorization', `Bearer ${token}`)
            .query({ youtubeChannelId: '', discordChannelId: '', guildId: '' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Query validation failed');
    });
    it('should return 404 for non-existent youtube config', async () => {
        const res = await request(app).get('/api/youtube/999999').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should delete a youtube config', async () => {
        const all = await configManager.youtubeManager.getMany({
            youtubeChannelId: testYoutube.youtubeChannelId,
            discordChannelId: testYoutube.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();

        const res = await request(app)
            .delete(`/api/youtube/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 when deleting non-existent youtube config', async () => {
        const res = await request(app)
            .delete('/api/youtube/999999')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should create/update channel config via POST /channel', async () => {
        const res = await request(app)
            .post('/api/youtube/channel')
            .set('Authorization', `Bearer ${token}`)
            .send({
                youtubeChannelId: 'newchannel',
                discordChannelId: 'newdiscord',
                guildId: 'testguild1'
            });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
    it('should return 400 when POST /channel with missing fields', async () => {
        const res = await request(app)
            .post('/api/youtube/channel')
            .set('Authorization', `Bearer ${token}`)
            .send({ youtubeChannelId: 'test' });
        expect(res.status).toBe(400);
    });
    it('should return 401 for POST /api/youtube without JWT', async () => {
        const res = await request(app)
            .post('/api/youtube')
            .send({ youtubeChannelId: 'ytchan3', discordChannelId: 'ytchan3discord', guildId: 'testguild3' });
        expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /api/youtube/:id without JWT', async () => {
        const all = await configManager.youtubeManager.getMany({ youtubeChannelId: testYoutube.youtubeChannelId });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await request(app)
            .delete(`/api/youtube/${id}`);
        expect(res.status).toBe(401);
    });

    it('should return 403 for POST /api/youtube as non-admin', async () => {
        const nonAdminToken = signTestJwt({ discordId: 'nonadminuser' });
        const res = await request(app)
            .post('/api/youtube')
            .set('Authorization', `Bearer ${nonAdminToken}`)
            .send({ youtubeChannelId: 'ytchan3', discordChannelId: 'ytchan3discord', guildId: 'testguild3' });
        expect([403, 401]).toContain(res.status);
    });

    it('should return 403 for DELETE /api/youtube/:id as non-admin', async () => {
        const nonAdminToken = signTestJwt({ discordId: 'nonadminuser' });
        const all = await configManager.youtubeManager.getMany({ youtubeChannelId: testYoutube.youtubeChannelId });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await request(app)
            .delete(`/api/youtube/${id}`)
            .set('Authorization', `Bearer ${nonAdminToken}`);
        expect([403, 401]).toContain(res.status);
    });

    it('should return 400 when POST /api/youtube with missing fields', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).post('/api/youtube').set('Authorization', `Bearer ${token}`).send({});
        expect(res.status).toBe(400);
    });

    it('should return 400 for DB error on POST /api/youtube', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Simulate DB error by sending invalid data
        const res = await request(app).post('/api/youtube').set('Authorization', `Bearer ${token}`).send({
            youtubeChannelId: null,
            discordChannelId: null,
            guildId: null
        });
        expect(res.status).toBe(400);
    });

    it('should return 400 for invalid id on DELETE /api/youtube/:id', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Invalid id is caught by validateParams; expect 400
        const res = await request(app).delete('/api/youtube/invalid').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it('should return 403 for ForbiddenError on DELETE /api/youtube/:id', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const all = await configManager.youtubeManager.getMany({ youtubeChannelId: testYoutube.youtubeChannelId });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        // Mock manager to throw ForbiddenError
        const origRemoveByPk = (configManager.youtubeManager as any).removeByPk as (id: number) => Promise<void>;
        (configManager.youtubeManager as any).removeByPk = async () => { throw new (await import('@zeffuro/fakegaming-common')).ForbiddenError('Forbidden'); };
        const res = await request(app).delete(`/api/youtube/${id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        (configManager.youtubeManager as any).removeByPk = origRemoveByPk;
    });

    it('should return 404 for NotFoundError on DELETE /api/youtube/:id', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const all = await configManager.youtubeManager.getMany({ youtubeChannelId: testYoutube.youtubeChannelId });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        // Mock manager to throw NotFoundError
        const origRemoveByPk = (configManager.youtubeManager as any).removeByPk as (id: number) => Promise<void>;
        (configManager.youtubeManager as any).removeByPk = async () => { throw new (await import('@zeffuro/fakegaming-common')).NotFoundError('Not found'); };
        const res = await request(app).delete(`/api/youtube/${id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        (configManager.youtubeManager as any).removeByPk = origRemoveByPk;
    });
});
