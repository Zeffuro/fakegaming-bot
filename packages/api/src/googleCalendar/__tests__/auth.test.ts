import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarConnection, CalendarOAuthState, CalendarSource } from '@zeffuro/fakegaming-common/models';
import { beginCalendarConnection, calendarStatus, completeCalendarConnection, decryptCalendarSecret, disconnectCalendar, encryptCalendarSecret, getCalendarToken, GOOGLE_SCOPES } from '../auth.js';

const userId = 'calendar-auth-owner';
const browser = 'browser'.padEnd(43, 'b');
const response = (refresh = true) => new Response(JSON.stringify({ access_token: 'access-secret', ...(refresh ? { refresh_token: 'refresh-secret' } : {}), expires_in: 3600, scope: GOOGLE_SCOPES.join(' ') }));

describe('Google Calendar authentication with persisted ownership', () => {
    beforeEach(async () => {
        vi.stubEnv('GOOGLE_CALENDAR_CLIENT_ID', 'test-client');
        vi.stubEnv('GOOGLE_CALENDAR_CLIENT_SECRET', 'test-secret');
        vi.stubEnv('GOOGLE_CALENDAR_REDIRECT_URI', 'http://localhost:3000/api/auth/google-calendar/callback');
        vi.stubEnv('GOOGLE_CALENDAR_TOKEN_ENC_KEY', 'test-encryption-key-at-least-thirty-two-characters');
        await CalendarSource.destroy({ where: { userId } });
        await CalendarOAuthState.destroy({ where: { userId } });
        await CalendarConnection.destroy({ where: { userId } });
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response())));
    });

    it('binds authenticated encryption to owner and purpose and detects modification', () => {
        const encrypted = encryptCalendarSecret('secret', userId, 'refresh');
        expect(encrypted).not.toContain('secret');
        expect(decryptCalendarSecret(encrypted, userId, 'refresh')).toBe('secret');
        expect(() => decryptCalendarSecret(encrypted, 'other', 'refresh')).toThrow();
        expect(() => decryptCalendarSecret(encrypted, userId, 'access')).toThrow();
        expect(() => decryptCalendarSecret(`${encrypted}.x`, userId, 'refresh')).toThrow();
    });

    it('requires owner, browser cookie, PKCE and a single-use persistent state', async () => {
        const started = await beginCalendarConnection(userId, browser);
        const url = new URL(started.url);
        expect(url.searchParams.get('scope')).toBe(GOOGLE_SCOPES.join(' '));
        expect(url.searchParams.get('code_challenge_method')).toBe('S256');
        expect(url.searchParams.get('code_challenge')).toHaveLength(43);
        await expect(completeCalendarConnection('wrong-owner', 'code', started.state, browser)).rejects.toMatchObject({ code: 'invalid_state' });
        await expect(completeCalendarConnection(userId, 'code', started.state, 'wrong-browser')).rejects.toMatchObject({ code: 'invalid_state' });
        expect(fetch).not.toHaveBeenCalled();
        await completeCalendarConnection(userId, 'code', started.state, browser);
        expect(new URLSearchParams((vi.mocked(fetch).mock.calls[0]![1]!.body as URLSearchParams).toString()).get('code_verifier')).toHaveLength(64);
        expect(await calendarStatus(userId)).toEqual({ configured: true, connected: true });
        expect(await getCalendarToken(userId)).toBe('access-secret');
        await expect(completeCalendarConnection(userId, 'code', started.state, browser)).rejects.toMatchObject({ code: 'invalid_state' });
    });

    it('rejects expired states and revoked/partial OAuth responses', async () => {
        const expired = await beginCalendarConnection(userId, browser);
        await CalendarOAuthState.update({ expiresAt: Date.now() - 1 }, { where: { userId } });
        await expect(completeCalendarConnection(userId, 'code', expired.state, browser)).rejects.toMatchObject({ code: 'invalid_state' });
        const started = await beginCalendarConnection(userId, browser);
        vi.mocked(fetch).mockResolvedValueOnce(response(false));
        await expect(completeCalendarConnection(userId, 'code', started.state, browser)).rejects.toMatchObject({ code: 'invalid_token' });
        expect(await calendarStatus(userId)).toMatchObject({ connected: false });
    });

    it('does not resurrect a disconnected connection when an OAuth exchange finishes late', async () => {
        const started = await beginCalendarConnection(userId, browser);
        let startedExchange!: () => void;
        const exchanging = new Promise<void>(resolve => { startedExchange = resolve; });
        let finish!: (response: Response) => void;
        vi.mocked(fetch).mockImplementationOnce(async () => { startedExchange(); return new Promise<Response>(resolve => { finish = resolve; }); });
        const complete = completeCalendarConnection(userId, 'code', started.state, browser);
        await exchanging;
        await disconnectCalendar(userId);
        finish(response());
        await expect(complete).rejects.toMatchObject({ code: 'conflict' });
        expect(await CalendarConnection.findByPk(userId)).toMatchObject({ status: 'disconnected', encryptedAccessToken: null, encryptedRefreshToken: null });
    });

    it('coalesces refreshes, retains omitted refresh tokens, and cannot undo concurrent disconnect', async () => {
        const started = await beginCalendarConnection(userId, browser);
        await completeCalendarConnection(userId, 'code', started.state, browser);
        const source = await CalendarSource.create({ id: 'refresh-source', userId, calendarId: 'calendar', label: 'Calendar', timezone: 'UTC',
            enabled: true, version: 3, lastSyncedAt: 100 });
        await CalendarConnection.update({ expiresAt: 0 }, { where: { userId } });
        vi.mocked(fetch).mockResolvedValueOnce(response(false));
        expect(await Promise.all([getCalendarToken(userId), getCalendarToken(userId)])).toEqual(['access-secret', 'access-secret']);
        expect(await source.reload()).toMatchObject({ version: 3, lastSyncedAt: 100, enabled: true });
        const row = (await CalendarConnection.findByPk(userId))!;
        expect(decryptCalendarSecret(row.encryptedRefreshToken!, userId, 'refresh')).toBe('refresh-secret');
        await row.update({ expiresAt: 0 });
        let begin!: () => void;
        const refreshing = new Promise<void>(resolve => { begin = resolve; });
        let finish!: (response: Response) => void;
        vi.mocked(fetch).mockImplementationOnce(async () => { begin(); return new Promise<Response>(resolve => { finish = resolve; }); });
        const token = getCalendarToken(userId);
        await refreshing;
        await disconnectCalendar(userId);
        finish(response(false));
        await expect(token).rejects.toMatchObject({ code: 'conflict' });
        await expect(getCalendarToken(userId)).rejects.toMatchObject({ code: 'not_connected' });
    });
});
