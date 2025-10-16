import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signTestJwt, expectForbidden, expectOk } from '@zeffuro/fakegaming-common/testing';

process.env.JWT_SECRET = 'supersecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
process.env.JWT_ISSUER = 'fakegaming';
process.env.API_URL = 'http://api.local';

function makeReq(opts: { method: string; jwt?: string; csrf?: string; headerCsrf?: string; body?: any }) {
    const { method, jwt, csrf, headerCsrf, body } = opts;
    return {
        method,
        nextUrl: { search: '' },
        headers: {
            get: (name: string) => {
                if (name.toLowerCase() === 'content-type') return 'application/json';
                if (name.toLowerCase() === 'x-csrf-token') return headerCsrf || null;
                return null;
            }
        },
        cookies: {
            get: (name: string) => {
                if (name === 'jwt' && jwt) return { value: jwt };
                if (name === 'csrf' && csrf) return { value: csrf };
                return undefined;
            }
        },
        json: async () => body,
        text: async () => JSON.stringify(body),
        url: 'http://dashboard.local/api/external/test'
    } as any;
}

describe('external proxy route CSRF', () => {
    let POST: any;

    beforeEach(async () => {
        vi.resetModules();
        // Mock global fetch to simulate API server with correct signature
        global.fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }) as unknown as typeof fetch;
        ({ POST } = await import('../../../app/api/external/[...proxy]/route.js'));
    });

    it('rejects POST without CSRF tokens', async () => {
        const jwt = signTestJwt({ discordId: '1' }, 'supersecret');
        const res = await POST(makeReq({ method: 'POST', jwt, body: { a: 1 } }), { params: Promise.resolve({ proxy: ['test'] }) } as any);
        expectForbidden(res);
        const body = await res.json();
        expect(body.error).toBe('CSRF');
    });

    it('allows POST with matching CSRF tokens', async () => {
        const jwt = signTestJwt({ discordId: '2' }, 'supersecret');
        const res = await POST(makeReq({ method: 'POST', jwt, csrf: 't123', headerCsrf: 't123', body: { a: 2 } }), { params: Promise.resolve({ proxy: ['test'] }) } as any);
        expectOk(res);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });
});
