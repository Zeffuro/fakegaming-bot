import { createHmac } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { seedUserGuilds, expectOk, expectCreated, expectConflict, expectForbidden, expectBadRequest, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';
import { TwitchClipConfig } from '@zeffuro/fakegaming-common/models';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { disconnectTwitchClipBot } from '../twitchClips/botAuth.js';

const payload = { guildId: 'guild-one', twitchUsername: 'Streamer', discordChannelId: 'channel-one' };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const admin = givenAuthenticatedClient(app, { discordId: 'guild-admin' });
const owner = givenAuthenticatedClient(app);
const outsider = givenAuthenticatedClient(app, { discordId: 'outsider' });

beforeEach(async () => {
    vi.stubEnv('DASHBOARD_ADMINS', 'testuser');
    vi.stubEnv('DISCORD_BOT_TOKEN', 'discord-token');
    vi.stubEnv('TWITCH_CLIENT_ID', 'client');
    vi.stubEnv('TWITCH_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('TWITCH_BOT_USERNAME', 'clipbot');
    vi.stubEnv('TWITCH_TOKEN_ENC_KEY', 'random-stable-secret');
    await TwitchClipConfig.destroy({ where: {} });
    await disconnectTwitchClipBot();
    await seedUserGuilds('guild-admin', [{ id: 'guild-one', permissions: '8' }, { id: 'guild-two', permissions: '0' }]);
    await seedUserGuilds('outsider', [{ id: 'guild-one', permissions: '0' }]);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (url.includes('discord.com')) return response({ guild_id: 'guild-one', type: 0 });
        if (url.includes('/oauth2/token')) return response({ access_token: 'app-token' });
        return response({ data: [{ id: 'broadcaster-one', login: 'streamer' }] });
    }));
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('Twitch clip configuration API', () => {
    it('creates normalized configs with defaults and server-resolved identity', async () => {
        const result = await admin.post('/api/twitchClips', payload);
        expectCreated(result);
        expect(result.body).toMatchObject({ ...payload, twitchUsername: 'streamer', broadcasterId: 'broadcaster-one',
            command: '!clip', aliases: [], permission: 'everyone', cooldownSeconds: 30, durationSeconds: 30, enabled: true,
            replyEnabled: true, replyTemplate: null });
        expect(result.body.id).toMatch(/^[a-f0-9-]{36}$/);
        expect(result.headers['cache-control']).toBe('private, no-store');
        const duplicate = await admin.post('/api/twitchClips', payload);
        expectConflict(duplicate);
    });

    it('persists custom reply settings and restores the default when a template is blank', async () => {
        const created = await admin.post('/api/twitchClips', { ...payload, replyEnabled: false, replyTemplate: '  {user}: {url}  ' });
        expectCreated(created);
        expect(created.body).toMatchObject({ replyEnabled: false, replyTemplate: '{user}: {url}' });
        const saved = await admin.get('/api/twitchClips?guildId=guild-one');
        expect(saved.body[0]).toMatchObject({ replyEnabled: false, replyTemplate: '{user}: {url}' });
        const reset = await admin.put(`/api/twitchClips/${created.body.id}`, { replyEnabled: true, replyTemplate: '   ' });
        expectOk(reset);
        expect(reset.body).toMatchObject({ replyEnabled: true, replyTemplate: null });
        expect((await TwitchClipConfig.findByPk(created.body.id))?.replyTemplate).toBeNull();
    });

    it('isolates list/update/delete and rejects moving a configuration into an unauthorized guild', async () => {
        const created = await admin.post('/api/twitchClips', payload);
        const id = created.body.id;
        const allowed = await admin.get('/api/twitchClips').query({ guildId: 'guild-one' });
        expect(allowed.body).toHaveLength(1);
        expectForbidden(await outsider.get('/api/twitchClips').query({ guildId: 'guild-one' }));
        expectForbidden(await admin.get('/api/twitchClips').query({ guildId: 'guild-two' }));
        expectForbidden(await outsider.put(`/api/twitchClips/${id}`, { enabled: false }));
        expectForbidden(await outsider.delete(`/api/twitchClips/${id}`));
        expectForbidden(await admin.put(`/api/twitchClips/${id}`, { guildId: 'guild-two' }));
        expect((await admin.put(`/api/twitchClips/${id}`, { command: '!CLIP', aliases: ['!SAVE', '!save'], enabled: false })).body)
            .toMatchObject({ command: '!clip', aliases: ['!save'], enabled: false });
        expectOk(await admin.delete(`/api/twitchClips/${id}`));
        expect(await TwitchClipConfig.count()).toBe(0);
    });

    it.each([
        { command: '!clip now' }, { aliases: ['!save clip'] }, { cooldownSeconds: 14 }, { cooldownSeconds: 3601 },
        { durationSeconds: 4 }, { durationSeconds: 61 }, { permission: 'vip' }, { broadcasterId: 'spoofed' },
        { replyTemplate: 'x'.repeat(401) }, { replyTemplate: 'two\nlines' }, { replyEnabled: 'true' },
    ])('rejects invalid config input %j', async (invalid) => {
        expectBadRequest(await admin.post('/api/twitchClips', { ...payload, ...invalid }));
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects a channel in another guild or a voice channel', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ guild_id: 'guild-two', type: 0 })));
        expectBadRequest(await admin.post('/api/twitchClips', payload));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ guild_id: 'guild-one', type: 2 })));
        expectBadRequest(await admin.post('/api/twitchClips', payload));
        expect(await TwitchClipConfig.count()).toBe(0);
    });

    it('keeps safe bot status authenticated and owner authorization dashboard-admin-only', async () => {
        expectUnauthorized(await owner.raw.get('/api/twitchClips/bot/status'));
        const status = await admin.get('/api/twitchClips/bot/status');
        expectOk(status);
        expect(status.body).toMatchObject({ configured: true, connected: false, login: null, expectedLogin: 'clipbot' });
        expect(JSON.stringify(status.body)).not.toContain('secret');
        expectForbidden(await admin.post('/api/twitchClips/bot/connect', {}));
        expectForbidden(await admin.delete('/api/twitchClips/bot'));
        expectOk(await owner.post('/api/twitchClips/bot/connect', {}));
    });

    it('binds trusted service OAuth state to the asserted administrator rather than synthetic service user', async () => {
        vi.stubEnv('SERVICE_API_TOKEN', 'service-token');
        const requestId = 'oauth-test';
        const signature = createHmac('sha256', process.env.JWT_SECRET!).update(`testuser:${requestId}`).digest('hex');
        const started = await owner.raw.post('/api/twitchClips/bot/connect').set('x-service-token', 'service-token')
            .set('x-dashboard-admin-user', 'testuser').set('x-dashboard-admin-request', requestId).set('x-dashboard-admin-signature', signature).send({});
        expectOk(started);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ access_token: 'user-token', refresh_token: 'refresh', expires_in: 3600 }))
            .mockResolvedValueOnce(response({ client_id: 'client', user_id: '42', login: 'clipbot', scopes: ['clips:edit', 'user:read:chat'], expires_in: 3600 })));
        const completed = await owner.post('/api/twitchClips/bot/complete', { code: 'code', state: started.body.state });
        expectOk(completed);
        expect((await owner.get('/api/twitchClips/bot/status')).body.login).toBe('clipbot');
        const untrusted = await owner.raw.post('/api/twitchClips/bot/connect').set('x-service-token', 'service-token')
            .set('x-dashboard-admin-user', 'testuser').set('x-dashboard-admin-request', requestId).set('x-dashboard-admin-signature', '00').send({});
        expectForbidden(untrusted);
    });

    it('accepts the authenticated dashboard callback without browser CSRF tokens while enforcing CSRF for direct writes', async () => {
        vi.stubEnv('SERVICE_API_TOKEN', 'service-token');
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        expectForbidden(await owner.post('/api/twitchClips/bot/connect', {}));
        const requestId = 'csrf-callback';
        const signature = createHmac('sha256', process.env.JWT_SECRET!).update(`testuser:${requestId}`).digest('hex');
        const servicePost = (path: string) => owner.raw.post(path).set('x-service-token', 'service-token')
            .set('x-dashboard-admin-user', 'testuser').set('x-dashboard-admin-request', requestId).set('x-dashboard-admin-signature', signature);
        const started = await servicePost('/api/twitchClips/bot/connect').send({});
        expectOk(started);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ access_token: 'user-token', refresh_token: 'refresh', expires_in: 3600 }))
            .mockResolvedValueOnce(response({ client_id: 'client', user_id: '42', login: 'clipbot', scopes: ['clips:edit', 'user:read:chat'], expires_in: 3600 })));
        expectOk(await servicePost('/api/twitchClips/bot/complete').send({ code: 'code', state: started.body.state }));
    });
});
