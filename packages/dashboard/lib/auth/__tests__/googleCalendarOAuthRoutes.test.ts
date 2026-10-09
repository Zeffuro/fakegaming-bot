import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectForbidden, expectOk, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';
const auth = vi.hoisted(() => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/auth/authUtils', () => auth);
vi.mock('@/lib/env', () => ({ API_URL: 'https://api.test/api', PUBLIC_URL: 'https://dashboard.test' }));
import { POST } from '../../../app/api/auth/google-calendar/connect/route';
import { GET } from '../../../app/api/auth/google-calendar/callback/route';
import { CALENDAR_BROWSER_COOKIE, CALENDAR_STATE_COOKIE } from '../googleCalendarOAuth';

const state = 'state'.padEnd(43, 's');
const browser = 'browser'.padEnd(43, 'b');
const url = `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`;
function connect(csrf = true) {
    return new NextRequest('https://dashboard.test/api/auth/google-calendar/connect', { method: 'POST', body: '{}',
        headers: { cookie: `jwt=session${csrf ? '; csrf=csrf-token' : ''}`, ...(csrf ? { 'x-csrf-token': 'csrf-token' } : {}) } });
}
function callback(cookieState = state, cookieBrowser = browser) {
    return new NextRequest(`https://dashboard.test/api/auth/google-calendar/callback?state=${state}&code=code`, {
        headers: { cookie: `jwt=session; csrf=csrf-token; ${CALENDAR_STATE_COOKIE}=${cookieState}; ${CALENDAR_BROWSER_COOKIE}=${cookieBrowser}` },
    });
}
describe('Google Calendar browser-bound OAuth', () => {
    beforeEach(() => {
        auth.authenticateUser.mockResolvedValue({ success: true, user: { discordId: 'owner' } });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ url, state })));
    });
    it('requires CSRF and a valid owner session before creating state', async () => {
        expectForbidden(await POST(connect(false)));
        auth.authenticateUser.mockResolvedValue({ success: false });
        expectUnauthorized(await POST(connect()));
        expect(fetch).not.toHaveBeenCalled();
    });
    it('keeps state and random browser binding in scoped HttpOnly cookies', async () => {
        const result = await POST(connect());
        expectOk(result);
        expect(result.cookies.get(CALENDAR_STATE_COOKIE)).toMatchObject({ value: state, httpOnly: true, sameSite: 'lax', path: '/api/auth/google-calendar', maxAge: 600 });
        const binding = result.cookies.get(CALENDAR_BROWSER_COOKIE);
        expect(binding?.value).toHaveLength(43);
        expect(binding?.httpOnly).toBe(true);
        const options = vi.mocked(fetch).mock.calls[0]![1]!;
        expect(JSON.parse(options.body as string)).toEqual({ browserBinding: binding?.value });
        expect(options.headers).toMatchObject({ Authorization: 'Bearer session', 'x-csrf-token': 'csrf-token' });
        expect(await result.json()).toEqual({ url });
    });
    it('rejects missing or different browser state and clears both cookies', async () => {
        for (const request of [callback('wrong'), callback(state, '')]) {
            const result = await GET(request);
            expect(result.headers.get('location')).toBe('https://dashboard.test/dashboard/me?googleCalendar=error');
            expect(result.cookies.get(CALENDAR_STATE_COOKIE)?.maxAge).toBe(0);
            expect(result.cookies.get(CALENDAR_BROWSER_COOKIE)?.maxAge).toBe(0);
        }
        expect(fetch).not.toHaveBeenCalled();
    });
    it('completes with the authenticated owner, state and browser binding and fixed return URL', async () => {
        vi.mocked(fetch).mockResolvedValue(Response.json({ success: true }));
        expect((await GET(callback())).headers.get('location')).toBe('https://dashboard.test/dashboard/me?googleCalendar=success');
        expect(fetch).toHaveBeenCalledWith('https://api.test/api/userCalendar/complete', expect.objectContaining({ body: JSON.stringify({ code: 'code', state, browserBinding: browser }) }));
        auth.authenticateUser.mockResolvedValue({ success: false });
        expect((await GET(callback())).headers.get('location')).toContain('googleCalendar=error');
    });
    it('rejects hostile authorization URLs and hides backend errors', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ url: 'https://evil.test/auth', state }));
        expect((await POST(connect())).ok).toBe(false);
        vi.mocked(fetch).mockRejectedValueOnce(new Error('secret provider value'));
        const result = await GET(callback());
        expect(result.headers.get('location')).toBe('https://dashboard.test/dashboard/me?googleCalendar=error');
    });
});
