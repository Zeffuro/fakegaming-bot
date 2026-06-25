import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectBadRequest, expectCreated, expectForbidden, expectNotFound, expectOk, expectUnauthorized, seedUserGuilds } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const testBluesky = {
    blueskyHandle: 'bsky.app',
    discordChannelId: 'testchannel1',
    guildId: 'testguild1'
};

beforeEach(async () => {
    await configManager.blueskyManager.removeAll();
    await seedUserGuilds('nonadminuser', [{ id: 'testguild2', permissions: '0' }]);
    await configManager.blueskyManager.add(testBluesky as never);
});

describe('Bluesky API', () => {
    const client = givenAuthenticatedClient(app);
    const nonAdmin = givenAuthenticatedClient(app, { discordId: 'nonadminuser' });

    it('lists all bluesky configs', async () => {
        const res = await client.get('/api/bluesky');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('gets a bluesky config by id', async () => {
        const all = await configManager.blueskyManager.getAllPlain();
        const id = all[0]?.id as number;
        const res = await client.get(`/api/bluesky/${id}`);
        expectOk(res);
        expect(res.body.blueskyHandle).toBe(testBluesky.blueskyHandle);
    });

    it('adds a new bluesky config and normalizes leading @', async () => {
        const res = await client.post('/api/bluesky', {
            blueskyHandle: '@example.bsky.social',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectCreated(res);
        expect(res.body.success).toBe(true);
        const created = await configManager.blueskyManager.getOnePlain({ blueskyHandle: 'example.bsky.social', guildId: 'testguild2' });
        expect(created).not.toBeNull();
    });

    it('checks if a config exists', async () => {
        const res = await client.get('/api/bluesky/exists')
            .query({ blueskyHandle: testBluesky.blueskyHandle, discordChannelId: testBluesky.discordChannelId, guildId: testBluesky.guildId });
        expectOk(res);
        expect(res.body.exists).toBe(true);
    });

    it('returns 401 for exists without JWT', async () => {
        const res = await client.raw
            .get('/api/bluesky/exists')
            .query({ blueskyHandle: 'x.bsky.social', discordChannelId: 'y', guildId: 'z' });
        expectUnauthorized(res);
    });

    it('returns 400 for exists with missing query', async () => {
        const res = await client.get('/api/bluesky/exists');
        expectBadRequest(res);
    });

    it('returns 404 for a non-existent config', async () => {
        const res = await client.get('/api/bluesky/999999');
        expectNotFound(res);
    });

    it('deletes a bluesky config', async () => {
        const all = await configManager.blueskyManager.getAllPlain();
        const id = all[0]?.id as number;
        const res = await client.delete(`/api/bluesky/${id}`);
        expectOk(res);
        expect(res.body.success).toBe(true);
    });

    it('returns 401 for create without JWT', async () => {
        const res = await client.raw.post('/api/bluesky').send({
            blueskyHandle: 'another.bsky.social',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectUnauthorized(res);
    });

    it('returns 403 for create as non-admin', async () => {
        const res = await nonAdmin.post('/api/bluesky', {
            blueskyHandle: 'another.bsky.social',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectForbidden(res);
    });
});
