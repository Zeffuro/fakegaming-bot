import { describe, it, expect } from 'vitest';
import { signTestJwt } from '../../../../common/dist/testing/utils/jwtTestUtils.js';

// Import after setting env
process.env.JWT_SECRET = 'supersecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
process.env.JWT_ISSUER = 'fakegaming';

const { PUT } = await import('../../../app/api/auth/me/route.js');

function makeReq(opts: { jwt?: string; csrf?: string; headerCsrf?: string }) {
    const { jwt, csrf, headerCsrf } = opts;
    return {
        method: 'PUT',
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

describe('auth/me route', () => {
    it('rejects missing CSRF token', async () => {
        const token = signTestJwt({ discordId: '42', username: 'u' }, 'supersecret');
        const res = await PUT(makeReq({ jwt: token }));
        const body = await res.json();
        expect(res.status).toBe(403);
        expect(body.error).toBe('CSRF');
    });

    it('rejects mismatched CSRF token', async () => {
        const token = signTestJwt({ discordId: '42', username: 'u' }, 'supersecret');
        const res = await PUT(makeReq({ jwt: token, csrf: 'a', headerCsrf: 'b' }));
        expect(res.status).toBe(403);
    });

    it('returns user on valid token + CSRF', async () => {
        const token = signTestJwt({ discordId: '42', username: 'alice' }, 'supersecret');
        const res = await PUT(makeReq({ jwt: token, csrf: 't', headerCsrf: 't' }));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.user.discordId).toBe('42');
        expect(body.user.username).toBe('alice');
    });
});
