import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectBadRequest } from '@zeffuro/fakegaming-common/testing';
import { GET as begin } from '@/app/api/auth/discord/route';
import { GET as finish } from '@/app/api/auth/discord/callback/route';
import { discordOAuthCookie } from '../discordOAuthState';

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), create: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common', async importOriginal => ({
    ...await importOriginal<object>(),
    exchangeCodeForToken: mocks.exchange,
    fetchDiscordUser: vi.fn().mockResolvedValue({ id: '42', username: 'test' }),
    getDiscordGuilds: vi.fn().mockResolvedValue([]),
    issueJwt: vi.fn().mockReturnValue('fixture-jwt'),
    defaultCacheManager: { set: vi.fn() },
}));
vi.mock('@/lib/auth/refreshSessions', () => ({ createRefreshSession: mocks.create }));
vi.mock('@/lib/env', () => {
    const config = { clientId: 'fixture', clientSecret: 'fixture', redirectUri: 'https://site.test/api/auth/discord/callback' };
    return { getDiscordOAuthAuthorizeConfig: () => config, getDiscordOAuthConfig: () => config, getJwtConfig: () => ({}) };
});

const startUrl = 'https://site.test/api/auth/discord';
function callback(state?: string, value?: string) {
    const url = new URL(`${startUrl}/callback?code=fixture-code`);
    if (state !== undefined) url.searchParams.set('state', state);
    const headers = new Headers();
    if (value) headers.set('cookie', `${discordOAuthCookie().name}=${value}`);
    return finish(new NextRequest(url, { headers }));
}

describe('Discord sign-in state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.exchange.mockResolvedValue({ access_token: 'fixture-access' });
        mocks.create.mockResolvedValue({ token: 'fixture-refresh' });
    });
    afterEach(() => vi.restoreAllMocks());

    it('binds even a default sign-in to a short-lived HTTP-only cookie and clears it on success', async () => {
        const start = await begin(new NextRequest(startUrl));
        const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
        const cookie = start.cookies.get(discordOAuthCookie().name)!;
        expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 600 });
        const next = await callback(state, cookie.value);
        expect(new URL(next.headers.get('location')!).pathname).toBe('/dashboard');
        expect(next.cookies.get(cookie.name)).toMatchObject({ maxAge: 0 });
        expect(mocks.exchange).toHaveBeenCalledOnce();
        expect(mocks.create).toHaveBeenCalledOnce();
    });

    it('rejects missing or mismatched state, a different browser and expired state before token exchange', async () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(2000);
        const start = await begin(new NextRequest(startUrl));
        const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
        const cookie = start.cookies.get(discordOAuthCookie().name)!.value;
        expectBadRequest(await callback(undefined, cookie));
        expectBadRequest(await callback(state));
        const different = await begin(new NextRequest(startUrl));
        expectBadRequest(await callback(state, different.cookies.get(discordOAuthCookie().name)!.value));
        clock.mockReturnValue(602_000);
        expectBadRequest(await callback(state, cookie));
        expect(mocks.exchange).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it.each([['/dashboard/me?tab=calendar', '/dashboard/me?tab=calendar'], ['/\\other.test/sign-in', '/dashboard']])(
        'redirects %s to a safe path on the dashboard origin', async (requested, expected) => {
            const url = new URL(startUrl);
            url.searchParams.set('returnTo', requested);
            const start = await begin(new NextRequest(url));
            const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
            const next = await callback(state, start.cookies.get(discordOAuthCookie().name)!.value);
            expect(next.headers.get('location')).toBe(`https://site.test${expected}`);
        },
    );
});
