import { describe, it, expect } from 'vitest';
import { signTestJwt, verifyTestJwt } from '../../../../common/dist/testing/utils/jwtTestUtils.js';

process.env.JWT_SECRET = 'supersecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
process.env.JWT_ISSUER = 'fakegaming';

const { POST } = await import('../../../app/api/auth/refresh/route.js');

function makeReq(opts: { jwt?: string; csrf?: string; headerCsrf?: string }) {
    const { jwt, csrf, headerCsrf } = opts;
    return {
        method: 'POST',
        cookies: {
            get: (name: string) => {
                if (name === 'jwt' && jwt) return { value: jwt };
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
    it('rejects missing CSRF token', async () => {
        const token = signTestJwt({ discordId: '42', username: 'u' }, 'supersecret');
        const res = await POST(makeReq({ jwt: token }));
        const body = await res.json();
        expect(res.status).toBe(403);
        expect(body.error).toBe('CSRF');
    });

    it('returns refreshed token on valid CSRF', async () => {
        const token = signTestJwt({ discordId: '42', username: 'u' }, 'supersecret');
        const res = await POST(makeReq({ jwt: token, csrf: 'x', headerCsrf: 'x' }));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.refreshed).toBe(true);
        // Validate new cookie attributes present
        const setCookieHeader = (res as any).cookies.get('jwt');
        expect(setCookieHeader).toBeDefined();
    });

    it('new token differs from old', async () => {
        const token = signTestJwt({ discordId: '42', username: 'u' }, 'supersecret');
        const res = await POST(makeReq({ jwt: token, csrf: 't', headerCsrf: 't' }));
        const newCookie = (res as any).cookies.get('jwt');
        expect(newCookie?.value).toBeDefined();
        expect(newCookie?.value).not.toBe(token);
        const decoded = verifyTestJwt(newCookie!.value, 'supersecret');
        expect(decoded.discordId).toBe('42');
    });
});
