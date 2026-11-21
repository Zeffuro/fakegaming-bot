import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
    verifyTestJwt,
    expectForbidden,
    expectOk,
    expectServiceUnavailable,
    expectUnauthorized
} from '@zeffuro/fakegaming-common/testing';

const store = vi.hoisted(() => ({ get: vi.fn(), eval: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common', async importOriginal => ({
    ...await importOriginal<object>(),
    requireRedis: async () => store,
}));

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
        store.get.mockReset().mockResolvedValue(null);
        store.eval.mockReset().mockResolvedValue(1);
    });

    async function importRoute() {
        return await import('../../../app/api/auth/refresh/route.js');
    }

    function mockRefreshSession() {
        store.get.mockResolvedValueOnce(JSON.stringify({
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
        }));
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
        expect(store.eval).toHaveBeenCalledOnce();
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

    it('does not clear cookies when a stale refresh session is rejected', async () => {
        const { POST } = await importRoute();
        const res = await POST(makeReq({ refreshSession: 'stale-refresh-token', csrf: 't', headerCsrf: 't' }));

        expectUnauthorized(res);
        expect((res as any).cookies.get('jwt')).toBeUndefined();
        expect((res as any).cookies.get('refresh_session')).toBeUndefined();
        expect(store.eval).not.toHaveBeenCalled();
    });

    it('returns service unavailable without issuing cookies when rotation cannot persist', async () => {
        mockRefreshSession();
        store.eval.mockRejectedValueOnce(new Error('Redis unavailable'));
        const { POST } = await importRoute();
        const res = await POST(makeReq({ refreshSession: 'refresh-token', csrf: 't', headerCsrf: 't' }));
        expectServiceUnavailable(res);
        expect(res.cookies.get('jwt')).toBeUndefined();
        expect(res.cookies.get('refresh_session')).toBeUndefined();
    });
});
