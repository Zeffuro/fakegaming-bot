import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
    mockCacheDelete,
    mockCacheGet,
    mockCacheSet,
    resetCacheMocks,
    setupCacheMocks,
    verifyTestJwt,
    expectForbidden,
    expectOk,
    expectUnauthorized
} from '@zeffuro/fakegaming-common/testing';

process.env.JWT_SECRET = 'supersecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
process.env.JWT_ISSUER = 'fakegaming';

function makeReq(opts: { refreshSession?: string; csrf?: string; headerCsrf?: string }) {
    const { refreshSession, csrf, headerCsrf } = opts;
    return {
        method: 'POST',
        cookies: {
            get: (name: string) => {
                if (name === 'refresh_session' && refreshSession) return { value: refreshSession };
                if (name === 'csrf' && csrf) return { value: csrf };
                return undefined;
            }
        },
        headers: {
            get: (name: string) => name.toLowerCase() === 'x-csrf-token' ? (headerCsrf || null) : null
        }
    } as any;
}

describe('auth/refresh route', () => {
    beforeEach(() => {
        vi.resetModules();
        setupCacheMocks();
        resetCacheMocks();
    });

    async function importRoute() {
        return await import('../../../app/api/auth/refresh/route.js');
    }

    function mockRefreshSession() {
        mockCacheGet.mockResolvedValueOnce({
            version: 1,
            user: {
                id: '42',
                username: 'u',
                global_name: null,
                avatar: null,
                discriminator: null
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            absoluteExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            discordRefreshToken: null
        });
    }

    it('rejects missing CSRF token', async () => {
        const { POST } = await importRoute();
        const res = await POST(makeReq({ refreshSession: 'refresh-token' }));
        const body = await res.json();
        expectForbidden(res);
        expect(body.error).toBe('CSRF');
    });

    it('returns refreshed token on valid refresh session and CSRF', async () => {
        mockRefreshSession();
        const { POST } = await importRoute();
        const res = await POST(makeReq({ refreshSession: 'refresh-token', csrf: 'x', headerCsrf: 'x' }));
        const body = await res.json();
        expectOk(res);
        expect(body.refreshed).toBe(true);
        expect((res as any).cookies.get('jwt')).toBeDefined();
        expect((res as any).cookies.get('refresh_session')).toBeDefined();
        expect(mockCacheDelete).toHaveBeenCalledTimes(1);
        expect(mockCacheSet).toHaveBeenCalledTimes(1);
    });

    it('new access token contains the refresh session user', async () => {
        mockRefreshSession();
        const { POST } = await importRoute();
        const res = await POST(makeReq({ refreshSession: 'refresh-token', csrf: 't', headerCsrf: 't' }));
        const newCookie = (res as any).cookies.get('jwt');
        expect(newCookie?.value).toBeDefined();
        const decoded = verifyTestJwt(newCookie!.value, 'supersecret');
        expect(decoded.discordId).toBe('42');
    });

    it('rejects missing refresh session', async () => {
        const { POST } = await importRoute();
        const res = await POST(makeReq({ csrf: 't', headerCsrf: 't' }));
        expectUnauthorized(res);
    });
});
