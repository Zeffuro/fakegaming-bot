import { describe, it, expect } from 'vitest';
import { signTestJwt, expectOk, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';

// Import after setting env
process.env.JWT_SECRET = 'supersecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
process.env.JWT_ISSUER = 'fakegaming';

const { GET, PUT } = await import('../../../app/api/auth/me/route.js');

function makeReq(opts: { jwt?: string }) {
    const { jwt } = opts;
    return {
        method: 'GET',
        cookies: {
            get: (name: string) => {
                if (name === 'jwt' && jwt) return { value: jwt };
                return undefined;
            }
        },
        headers: {
            get: (_name: string) => null
        }
    } as any;
}

describe('auth/me route', () => {
    it('rejects missing access token', async () => {
        const res = await GET(makeReq({}));
        const body = await res.json();
        expectUnauthorized(res);
        expect(body.error).toBe('Not authenticated');
    });

    it('returns user on valid token', async () => {
        const token = signTestJwt({ discordId: '42', username: 'alice' }, 'supersecret');
        const res = await GET(makeReq({ jwt: token }));
        const body = await res.json();
        expectOk(res);
        expect(body.user.discordId).toBe('42');
        expect(body.user.username).toBe('alice');
    });

    it('keeps PUT as a compatibility alias', async () => {
        const token = signTestJwt({ discordId: '42', username: 'alice' }, 'supersecret');
        const res = await PUT(makeReq({ jwt: token }));
        expectOk(res);
    });
});
