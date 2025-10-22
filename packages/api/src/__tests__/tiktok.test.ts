import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectOk, expectCreated, expectUnauthorized, expectForbidden, expectBadRequest, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const testTikTok = {
    tiktokUsername: 'testcreator',
    discordChannelId: 'testchannel1',
    guildId: 'testguild1'
};

beforeEach(async () => {
    await configManager.tiktokManager.removeAll();
    await configManager.tiktokManager.add(testTikTok as any);
});

describe('TikTok API', () => {
    const client = givenAuthenticatedClient(app);
    const nonAdmin = givenAuthenticatedClient(app, { discordId: 'nonadminuser' });

    it('should list all tiktok configs', async () => {
        const res = await client.get('/api/tiktok');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get a tiktok config by id', async () => {
        const all = await configManager.tiktokManager.getAllPlain();
        const id = all[0]?.id as number;
        const res = await client.get(`/api/tiktok/${id}`);
        expectOk(res);
        expect(res.body.tiktokUsername).toBe(testTikTok.tiktokUsername);
    });

    it('should add a new tiktok config', async () => {
        const res = await client.post('/api/tiktok', {
            tiktokUsername: 'anothercreator',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectCreated(res);
        expect(res.body.success).toBe(true);
    });

    it('should check if a stream exists', async () => {
        const res = await client.get('/api/tiktok/exists')
            .query({ tiktokUsername: testTikTok.tiktokUsername, discordChannelId: testTikTok.discordChannelId, guildId: testTikTok.guildId });
        expectOk(res);
        expect(res.body.exists).toBe(true);
    });

    it('should return 401 for GET /api/tiktok/exists without JWT', async () => {
        const res = await client.raw
            .get('/api/tiktok/exists')
            .query({ tiktokUsername: 'x', discordChannelId: 'y', guildId: 'z' });
        expectUnauthorized(res);
    });

    it('should return 400 for GET /api/tiktok/exists with missing query', async () => {
        const res = await client.get('/api/tiktok/exists');
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Query validation failed');
    });

    it('should return false for non-existent stream', async () => {
        const res = await client.get('/api/tiktok/exists')
            .query({ tiktokUsername: 'nonexistent', discordChannelId: 'nonexistent', guildId: 'testguild1' });
        expectOk(res);
        expect(res.body.exists).toBe(false);
    });

    it('should return 404 for non-existent tiktok config', async () => {
        const res = await client.get('/api/tiktok/999999');
        expectNotFound(res);
    });

    it('should delete a tiktok config', async () => {
        const all = await configManager.tiktokManager.getAllPlain();
        const id = all[0]?.id as number;
        const res = await client.delete(`/api/tiktok/${id}`);
        expectOk(res);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 when deleting non-existent tiktok config', async () => {
        const res = await client.delete('/api/tiktok/999999');
        expectNotFound(res);
    });

    it('should return 400 when POST /api/tiktok with missing fields', async () => {
        const res = await client.post('/api/tiktok', {} as any);
        expectBadRequest(res);
    });

    it('should return 401 for POST /api/tiktok without JWT', async () => {
        const res = await client.raw.post('/api/tiktok').send({
            tiktokUsername: 'anothercreator',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectUnauthorized(res);
    });

    it('should return 403 for POST /api/tiktok as non-admin', async () => {
        const res = await nonAdmin.post('/api/tiktok', {
            tiktokUsername: 'anothercreator',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectForbidden(res);
    });

    it('should return 400 for invalid id on DELETE /api/tiktok/:id', async () => {
        const res = await client.delete('/api/tiktok/invalid');
        expectBadRequest(res);
    });
});
