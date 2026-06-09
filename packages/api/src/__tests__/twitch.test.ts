import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectOk, expectCreated, expectUnauthorized, expectForbidden, expectBadRequest, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';
import { getFirstTwitchId } from './helpers/twitch.js';

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

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('Twitch API', () => {
    const client = givenAuthenticatedClient(app);
    const nonAdmin = givenAuthenticatedClient(app, { discordId: 'nonadminuser' });

    it('should list all twitch configs', async () => {
        const res = await client.get('/api/twitch');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get a twitch config by id', async () => {
        const id = await getFirstTwitchId();
        const res = await client.get(`/api/twitch/${id}`);
        expectOk(res);
        expect(res.body.twitchUsername).toBe(testTwitch.twitchUsername);
    });
    it('should add a new twitch config', async () => {
        const res = await client.post('/api/twitch', {
            twitchUsername: 'anotherstreamer',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectCreated(res);
        expect(res.body.success).toBe(true);
    });
    it('should check if a stream exists', async () => {
        const res = await client.get('/api/twitch/exists')
            .query({ twitchUsername: testTwitch.twitchUsername, discordChannelId: testTwitch.discordChannelId, guildId: testTwitch.guildId });
        expectOk(res);
        expect(res.body.exists).toBe(true);
    });
    it('should return 401 for GET /api/twitch/exists without JWT', async () => {
        const res = await client.raw
            .get('/api/twitch/exists')
            .query({ twitchUsername: 'x', discordChannelId: 'y', guildId: 'z' });
        expectUnauthorized(res);
    });
    it('should return 400 for GET /api/twitch/exists with missing query', async () => {
        const res = await client.get('/api/twitch/exists');
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Query validation failed');
    });
    it('should return 400 for GET /api/twitch/exists with empty values', async () => {
        const res = await client.get('/api/twitch/exists')
            .query({ twitchUsername: '', discordChannelId: '', guildId: '' });
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Query validation failed');
    });
    it('should return false for non-existent stream', async () => {
        const res = await client.get('/api/twitch/exists')
            .query({ twitchUsername: 'nonexistent', discordChannelId: 'nonexistent', guildId: 'testguild1' });
        expectOk(res);
        expect(res.body.exists).toBe(false);
    });

    it('should verify twitch username using credentials and first repeated query value', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token-1' }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [{ id: 'user-1', login: 'creator', display_name: 'Creator Display' }]
                })
            });
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('TWITCH_CLIENT_ID', 'client-id');
        vi.stubEnv('TWITCH_CLIENT_SECRET', 'client-secret');

        const res = await client
            .get('/api/twitch/verify')
            .query({ twitchUsername: [' creator ', 'ignored'] });

        expectOk(res);
        expect(res.body).toEqual({
            exists: true,
            id: 'user-1',
            login: 'creator',
            displayName: 'Creator Display'
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should return false when twitch verify credentials are missing', async () => {
        vi.stubEnv('TWITCH_CLIENT_ID', '');
        vi.stubEnv('TWITCH_CLIENT_SECRET', '');

        const res = await client.get('/api/twitch/verify').query({ username: 'creator' });

        expectOk(res);
        expect(res.body).toEqual({ exists: false });
    });

    it('should reject twitch verify missing username', async () => {
        const res = await client.get('/api/twitch/verify');

        expectBadRequest(res);
    });

    it('should return false when twitch token request fails', async () => {
        vi.stubEnv('TWITCH_CLIENT_ID', 'client-id');
        vi.stubEnv('TWITCH_CLIENT_SECRET', 'client-secret');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }));

        const res = await client.get('/api/twitch/verify').query({ username: 'creator' });

        expectOk(res);
        expect(res.body).toEqual({ exists: false });
    });

    it('should return false when twitch user lookup fails or has no user', async () => {
        vi.stubEnv('TWITCH_CLIENT_ID', 'client-id');
        vi.stubEnv('TWITCH_CLIENT_SECRET', 'client-secret');
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token-1' }) })
            .mockResolvedValueOnce({ ok: false }));

        const failedLookup = await client.get('/api/twitch/verify').query({ username: 'creator' });
        expectOk(failedLookup);
        expect(failedLookup.body).toEqual({ exists: false });

        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token-2' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }));

        const missingUser = await client.get('/api/twitch/verify').query({ username: 'missing' });
        expectOk(missingUser);
        expect(missingUser.body).toEqual({ exists: false });
    });

    it('should return false when twitch verify throws', async () => {
        vi.stubEnv('TWITCH_CLIENT_ID', 'client-id');
        vi.stubEnv('TWITCH_CLIENT_SECRET', 'client-secret');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')));

        const res = await client.get('/api/twitch/verify').query({ username: 'creator' });

        expectOk(res);
        expect(res.body).toEqual({ exists: false });
    });
    it('should return 404 for non-existent twitch config', async () => {
        const res = await client.get('/api/twitch/999999');
        expectNotFound(res);
    });

    it('should delete a twitch config', async () => {
        const id = await getFirstTwitchId();
        const res = await client.delete(`/api/twitch/${id}`);
        expectOk(res);
        expect(res.body.success).toBe(true);
    });

    it('should update a twitch config by id', async () => {
        const id = await getFirstTwitchId();
        const res = await client.put(`/api/twitch/${id}`, {
            twitchUsername: 'updatedstreamer',
            discordChannelId: 'updatedchannel',
            guildId: 'testguild1',
            customMessage: 'Updated live message',
            cooldownMinutes: 5,
            quietHoursStart: null,
            quietHoursEnd: null
        });

        expectOk(res);
        expect(res.body.twitchUsername).toBe('updatedstreamer');
        expect(res.body.discordChannelId).toBe('updatedchannel');
    });

    it('should return 404 when updating non-existent twitch config', async () => {
        const res = await client.put('/api/twitch/999999', {
            twitchUsername: 'updatedstreamer',
            discordChannelId: 'updatedchannel',
            guildId: 'testguild1'
        });

        expectNotFound(res);
    });

    it('should return 400 for invalid PUT id or body', async () => {
        const invalidId = await client.put('/api/twitch/invalid', {
            twitchUsername: 'updatedstreamer',
            discordChannelId: 'updatedchannel',
            guildId: 'testguild1'
        });
        expectBadRequest(invalidId);

        const id = await getFirstTwitchId();
        const invalidBody = await client.put(`/api/twitch/${id}`, {
            twitchUsername: null,
            discordChannelId: 123,
            guildId: 'testguild1'
        } as any);
        expectBadRequest(invalidBody);
    });

    it('should return 404 when deleting non-existent twitch config', async () => {
        const res = await client.delete('/api/twitch/999999');
        expectNotFound(res);
    });

    it('should return 400 when POST /api/twitch with missing fields', async () => {
        const res = await client.post('/api/twitch', {} as any);
        expectBadRequest(res);
    });

    it('should return 401 for POST /api/twitch without JWT', async () => {
        const res = await client.raw.post('/api/twitch').send({
            twitchUsername: 'anotherstreamer',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectUnauthorized(res);
    });

    it('should return 403 for POST /api/twitch as non-admin', async () => {
        const res = await nonAdmin.post('/api/twitch', {
            twitchUsername: 'anotherstreamer',
            discordChannelId: 'testchannel2',
            guildId: 'testguild2'
        });
        expectForbidden(res);
    });

    it('should return 401 for DELETE /api/twitch/:id without JWT', async () => {
        const id = await getFirstTwitchId();
        const res = await client.raw.delete(`/api/twitch/${id}`);
        expectUnauthorized(res);
    });

    it('should return 403 for DELETE /api/twitch/:id as non-admin', async () => {
        const id = await getFirstTwitchId();
        const res = await nonAdmin.delete(`/api/twitch/${id}`);
        expectForbidden(res);
    });

    it('should return 400 for DB error on POST /api/twitch', async () => {
        // Simulate DB error by sending invalid data
        const res = await client.post('/api/twitch', {
            twitchUsername: null as any,
            discordChannelId: null as any,
            guildId: null as any
        });
        expectBadRequest(res);
    });

    it('should return 400 for invalid id on DELETE /api/twitch/:id', async () => {
        // Invalid id is caught by validateParams; expect 400 (input validation)
        const res = await client.delete('/api/twitch/invalid');
        expectBadRequest(res);
    });

    it('should return 403 for ForbiddenError on DELETE /api/twitch/:id', async () => {
        const id = await getFirstTwitchId();
        // Mock manager to throw ForbiddenError
        const origRemoveByPk = (configManager.twitchManager as any).removeByPk as (id: number) => Promise<void>;
        (configManager.twitchManager as any).removeByPk = async () => { throw new (await import('@zeffuro/fakegaming-common')).ForbiddenError('Forbidden'); };
        const res = await client.delete(`/api/twitch/${id}`);
        expectForbidden(res);
        (configManager.twitchManager as any).removeByPk = origRemoveByPk;
    });

    it('should return 404 for NotFoundError on DELETE /api/twitch/:id', async () => {
        const id = await getFirstTwitchId();
        // Mock manager to throw NotFoundError
        const origRemoveByPk = (configManager.twitchManager as any).removeByPk as (id: number) => Promise<void>;
        (configManager.twitchManager as any).removeByPk = async () => { throw new (await import('@zeffuro/fakegaming-common')).NotFoundError('Not found'); };
        const res = await client.delete(`/api/twitch/${id}`);
        expectNotFound(res);
        (configManager.twitchManager as any).removeByPk = origRemoveByPk;
    });

    it('should upsert on duplicate POST (idempotent by guildId+twitchUsername)', async () => {
        const payload = {
            twitchUsername: 'dupstreamer',
            discordChannelId: 'chan-1',
            guildId: 'testguild1'
        };
        const first = await client.post('/api/twitch', payload);
        expectCreated(first);
        const second = await client.post('/api/twitch', payload);
        // Second call should not 500; treat as OK (updated)
        expectOk(second);
    });
});
