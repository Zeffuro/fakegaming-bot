import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectOk, expectCreated, expectUnauthorized, expectForbidden, expectBadRequest, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

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
    const client = givenAuthenticatedClient(app);

    it('should list all youtube configs', async () => {
        const res = await client.get('/api/youtube');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a youtube config by id', async () => {
        const all = await configManager.youtubeManager.getMany({
            youtubeChannelId: testYoutube.youtubeChannelId,
            discordChannelId: testYoutube.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await client.get(`/api/youtube/${id}`);
        expectOk(res);
        expect(res.body.youtubeChannelId).toBe(testYoutube.youtubeChannelId);
    });
    it('should add a new youtube config', async () => {
        const res = await client.post('/api/youtube', {
            youtubeChannelId: 'ytchan2',
            discordChannelId: 'ytchan2discord',
            guildId: 'testguild2'
        });
        expectCreated(res);
        expect(res.body.youtubeChannelId).toBe('ytchan2');
    });
    it('should upsert a youtube config', async () => {
        const res = await client.put('/api/youtube', {
            youtubeChannelId: 'ytchan1',
            discordChannelId: 'ytchan1discord',
            guildId: 'testguild1'
        });
        expectOk(res);
        expect(res.body.success).toBe(true);
    });
    it('should get a youtube config by channel', async () => {
        const res = await client.get('/api/youtube/channel')
            .query({youtubeChannelId: 'ytchan1', discordChannelId: 'ytchan1discord', guildId: 'testguild1'});
        expectOk(res);
        expect(res.body.youtubeChannelId).toBe('ytchan1');
    });
    it('should return 401 for GET /api/youtube/channel without JWT', async () => {
        const res = await client.raw
            .get('/api/youtube/channel')
            .query({ youtubeChannelId: 'ytchan1', discordChannelId: 'ytchan1discord', guildId: 'testguild1' });
        expectUnauthorized(res);
    });
    it('should return 400 for GET /api/youtube/channel with missing query', async () => {
        const res = await client.get('/api/youtube/channel');
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Query validation failed');
        expect(Array.isArray(res.body.error.details)).toBe(true);
    });
    it('should return 400 for GET /api/youtube/channel with empty values', async () => {
        const res = await client.get('/api/youtube/channel')
            .query({ youtubeChannelId: '', discordChannelId: '', guildId: '' });
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Query validation failed');
    });
    it('should return 404 for non-existent youtube config', async () => {
        const res = await client.get('/api/youtube/999999');
        expectNotFound(res);
    });

    it('should delete a youtube config', async () => {
        const all = await configManager.youtubeManager.getMany({
            youtubeChannelId: testYoutube.youtubeChannelId,
            discordChannelId: testYoutube.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();

        const res = await client.delete(`/api/youtube/${id}`);
        expectOk(res);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 when deleting non-existent youtube config', async () => {
        const res = await client.delete('/api/youtube/999999');
        expectNotFound(res);
    });

    it('should create/update channel config via POST /channel', async () => {
        const res = await client.post('/api/youtube/channel', {
            youtubeChannelId: 'newchannel',
            discordChannelId: 'newdiscord',
            guildId: 'testguild1'
        });
        expectCreated(res);
        expect(res.body.success).toBe(true);
    });
    it('should return 400 when POST /channel with missing fields', async () => {
        const res = await client.post('/api/youtube/channel', { youtubeChannelId: 'test' } as any);
        expectBadRequest(res);
    });
    it('should return 401 for POST /api/youtube without JWT', async () => {
        const res = await client.raw
            .post('/api/youtube')
            .send({ youtubeChannelId: 'ytchan3', discordChannelId: 'ytchan3discord', guildId: 'testguild3' });
        expectUnauthorized(res);
    });

    it('should return 401 for DELETE /api/youtube/:id without JWT', async () => {
        const all = await configManager.youtubeManager.getMany({ youtubeChannelId: testYoutube.youtubeChannelId });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await client.raw
            .delete(`/api/youtube/${id}`);
        expectUnauthorized(res);
    });

    it('should return 403 for POST /api/youtube as non-admin', async () => {
        const nonAdmin = givenAuthenticatedClient(app, { discordId: 'nonadminuser' });
        const res = await nonAdmin
            .post('/api/youtube')
            .send({ youtubeChannelId: 'ytchan3', discordChannelId: 'ytchan3discord', guildId: 'testguild3' });
        expectForbidden(res);
    });

    it('should return 403 for DELETE /api/youtube/:id as non-admin', async () => {
        const all = await configManager.youtubeManager.getMany({ youtubeChannelId: testYoutube.youtubeChannelId });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const nonAdmin = givenAuthenticatedClient(app, { discordId: 'nonadminuser' });
        const res = await nonAdmin.delete(`/api/youtube/${id}`);
        expectForbidden(res);
    });

    it('should return 400 when POST /api/youtube with missing fields', async () => {
        const res = await client.post('/api/youtube', {} as any);
        expectBadRequest(res);
    });

    it('should return 400 for DB error on POST /api/youtube', async () => {
        // Simulate DB error by sending invalid data
        const res = await client.post('/api/youtube', {
            youtubeChannelId: null as any,
            discordChannelId: null as any,
            guildId: null as any
        });
        expectBadRequest(res);
    });

    it('should return 400 for invalid id on DELETE /api/youtube/:id', async () => {
        // Invalid id is caught by validateParams; expect 400
        const res = await client.delete('/api/youtube/invalid');
        expectBadRequest(res);
    });

    it('should return 403 for ForbiddenError on DELETE /api/youtube/:id', async () => {
        const all = await configManager.youtubeManager.getMany({ youtubeChannelId: testYoutube.youtubeChannelId });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        // Mock manager to throw ForbiddenError
        const origRemoveByPk = (configManager.youtubeManager as any).removeByPk as (id: number) => Promise<void>;
        (configManager.youtubeManager as any).removeByPk = async () => { throw new (await import('@zeffuro/fakegaming-common')).ForbiddenError('Forbidden'); };
        const res = await client.delete(`/api/youtube/${id}`);
        expectForbidden(res);
        (configManager.youtubeManager as any).removeByPk = origRemoveByPk;
    });
});
