import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwitchClipBotAuth, TwitchClipOAuthState } from '@zeffuro/fakegaming-common/models';
import { beginTwitchClipBotConnection, completeTwitchClipBotConnection, disconnectTwitchClipBot,
    getTwitchClipBotToken, invalidateTwitchClipBotToken } from '../twitchClips/botAuth.js';

const identity = { client_id: 'client', user_id: '42', login: 'clipbot', scopes: ['user:read:chat', 'clips:edit'], expires_in: 3600 };
const tokens = { access_token: 'access-secret', refresh_token: 'refresh-secret', expires_in: 3600 };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

beforeEach(async () => {
    vi.stubEnv('TWITCH_CLIENT_ID', 'client');
    vi.stubEnv('TWITCH_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('TWITCH_BOT_USERNAME', 'clipbot');
    vi.stubEnv('TWITCH_REDIRECT_URI', 'http://localhost:3000/api/auth/twitch/callback');
    vi.stubEnv('TWITCH_TOKEN_ENC_KEY', 'stable-random-secret');
    await disconnectTwitchClipBot();
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    invalidateTwitchClipBotToken();
});

async function connect() {
    const started = await beginTwitchClipBotConnection('admin');
    await completeTwitchClipBotConnection('admin', 'code', started.state);
}

describe('Twitch clip bot OAuth', () => {
    it('requests only chat reading and clip editing scopes and hashes actor-bound state', async () => {
        const { url, state } = await beginTwitchClipBotConnection('admin');
        const params = new URL(url).searchParams;
        expect(params.get('scope')).toBe('user:read:chat clips:edit');
        expect(params.get('force_verify')).toBe('true');
        const row = await TwitchClipOAuthState.findOne();
        expect(row?.id).not.toBe(state);
        expect(row?.actorId).toBe('admin');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(completeTwitchClipBotConnection('other-admin', 'code', state)).rejects.toMatchObject({ code: 'invalid_state' });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(await TwitchClipOAuthState.count()).toBe(1);
    });

    it('persists authenticated encrypted credentials and rejects replay', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(response(tokens)).mockResolvedValueOnce(response(identity));
        vi.stubGlobal('fetch', fetchMock);
        const { state } = await beginTwitchClipBotConnection('admin');
        await completeTwitchClipBotConnection('admin', 'code', state);
        const row = await TwitchClipBotAuth.findByPk('default');
        expect(row?.encryptedAccessToken).not.toContain(tokens.access_token);
        expect(row?.encryptedRefreshToken).not.toContain(tokens.refresh_token);
        expect(row?.login).toBe('clipbot');
        expect(row?.userId).toBe('42');
        await expect(completeTwitchClipBotConnection('admin', 'code', state)).rejects.toMatchObject({ code: 'invalid_state' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([
        { login: 'streamer' },
        { client_id: 'different-client' },
        { scopes: ['user:read:chat'] },
        { scopes: ['clips:edit'] },
    ])('rejects credentials with wrong identity, client or scope: %j', async (invalid) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(tokens)).mockResolvedValueOnce(response({ ...identity, ...invalid })));
        await expect(connect()).rejects.toMatchObject({ code: 'identity_mismatch' });
        expect(await TwitchClipBotAuth.count()).toBe(0);
    });

    it('rejects expired states before exchanging a code', async () => {
        const { state } = await beginTwitchClipBotConnection('admin');
        await TwitchClipOAuthState.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { actorId: 'admin' } });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(completeTwitchClipBotConnection('admin', 'code', state)).rejects.toMatchObject({ code: 'invalid_state' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('validates after startup and invalidation while sharing concurrent requests', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(response(tokens)).mockImplementation(async () => response(identity));
        vi.stubGlobal('fetch', fetchMock);
        await connect();
        const results = await Promise.all([getTwitchClipBotToken(), getTwitchClipBotToken(), getTwitchClipBotToken()]);
        expect(results).toEqual(Array(3).fill({ accessToken: tokens.access_token, userId: '42', login: 'clipbot' }));
        expect(fetchMock).toHaveBeenCalledTimes(3);
        await getTwitchClipBotToken();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        invalidateTwitchClipBotToken();
        await getTwitchClipBotToken();
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('refreshes once, persists rotated encrypted tokens and uses the persisted refresh token next time', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(response(tokens)).mockResolvedValueOnce(response(identity));
        vi.stubGlobal('fetch', fetchMock);
        await connect();
        await TwitchClipBotAuth.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: 'default' } });
        const refreshed = { access_token: 'rotated-access', refresh_token: 'rotated-refresh', expires_in: 3600 };
        fetchMock.mockResolvedValueOnce(response(refreshed)).mockResolvedValueOnce(response(identity));
        const [first, second] = await Promise.all([getTwitchClipBotToken(), getTwitchClipBotToken()]);
        expect(first).toEqual(second);
        expect(first.accessToken).toBe('rotated-access');
        expect(fetchMock).toHaveBeenCalledTimes(4);
        const stored = await TwitchClipBotAuth.findByPk('default');
        expect(stored?.encryptedAccessToken).not.toContain('rotated-access');
        await TwitchClipBotAuth.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: 'default' } });
        fetchMock.mockResolvedValueOnce(response(refreshed)).mockResolvedValueOnce(response(identity));
        await getTwitchClipBotToken();
        const body = fetchMock.mock.calls[4]?.[1]?.body as URLSearchParams;
        expect(body.get('refresh_token')).toBe('rotated-refresh');
    });

    it('refreshes an externally revoked access token after validation returns 401', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(response(tokens)).mockResolvedValueOnce(response(identity));
        vi.stubGlobal('fetch', fetchMock);
        await connect();
        fetchMock.mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(response({ ...tokens, access_token: 'new-access' })).mockResolvedValueOnce(response(identity));
        expect((await getTwitchClipBotToken()).accessToken).toBe('new-access');
    });

    it('revalidates identity before an hour passes even when the token remains valid', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(response(tokens)).mockImplementation(async () => response({ ...identity, expires_in: 7200 }));
        vi.stubGlobal('fetch', fetchMock);
        await connect();
        await getTwitchClipBotToken();
        const later = Date.now() + 56 * 60 * 1000;
        vi.spyOn(Date, 'now').mockReturnValue(later);
        await getTwitchClipBotToken();
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(fetchMock.mock.calls[3]?.[0]).toBe('https://id.twitch.tv/oauth2/validate');
    });

    it('retains rotated credentials if validation is temporarily unavailable, then validates before use', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(response(tokens)).mockResolvedValueOnce(response(identity));
        vi.stubGlobal('fetch', fetchMock);
        await connect();
        await TwitchClipBotAuth.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: 'default' } });
        fetchMock.mockResolvedValueOnce(response({ ...tokens, access_token: 'rotated-access', refresh_token: 'rotated-refresh' }))
            .mockResolvedValueOnce(response({}, 503));
        await expect(getTwitchClipBotToken()).rejects.toMatchObject({ code: 'provider_unavailable' });
        fetchMock.mockResolvedValueOnce(response(identity));
        expect((await getTwitchClipBotToken()).accessToken).toBe('rotated-access');
        expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it('does not return a refreshed token when storing its rotation fails', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(response(tokens)).mockResolvedValueOnce(response(identity));
        vi.stubGlobal('fetch', fetchMock);
        await connect();
        await TwitchClipBotAuth.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: 'default' } });
        fetchMock.mockResolvedValueOnce(response({ ...tokens, access_token: 'rotated-access' }));
        vi.spyOn(TwitchClipBotAuth.prototype, 'update').mockRejectedValueOnce(new Error('storage unavailable'));
        await expect(getTwitchClipBotToken()).rejects.toThrow('storage unavailable');
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('rejects tampered ciphertext or a changed encryption key', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(tokens)).mockImplementation(async () => response(identity)));
        await connect();
        vi.stubEnv('TWITCH_TOKEN_ENC_KEY', 'changed-key');
        await expect(getTwitchClipBotToken()).rejects.toMatchObject({ code: 'invalid_token' });
        vi.stubEnv('TWITCH_TOKEN_ENC_KEY', 'stable-random-secret');
        const row = await TwitchClipBotAuth.findByPk('default');
        await row!.update({ encryptedAccessToken: row!.encryptedAccessToken.slice(0, -5) });
        await expect(getTwitchClipBotToken()).rejects.toMatchObject({ code: 'invalid_token' });
    });

    it('reads persisted disconnection rather than retaining cached credentials', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(tokens)).mockImplementation(async () => response(identity)));
        await connect();
        await getTwitchClipBotToken();
        await disconnectTwitchClipBot();
        await expect(getTwitchClipBotToken()).rejects.toMatchObject({ code: 'not_connected' });
    });
});
