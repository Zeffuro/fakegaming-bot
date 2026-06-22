import { createHmac } from 'node:crypto';
import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { signTestJwt, expectForbidden, expectOk } from '@zeffuro/fakegaming-common/testing';

const OLD_ENV = { ...process.env };

function makeReq(opts: { method: string; jwt?: string; csrf?: string; headerCsrf?: string; body?: any; requestId?: string; search?: string }) {
    const { method, jwt, csrf, headerCsrf, body, requestId, search = '' } = opts;
    return {
        method,
        nextUrl: { search },
        headers: {
            get: (name: string) => {
                if (name.toLowerCase() === 'content-type') return 'application/json';
                if (name.toLowerCase() === 'x-csrf-token') return headerCsrf || null;
                if (name.toLowerCase() === 'x-request-id') return requestId || null;
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
    let GET: any;
    let POST: any;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        process.env = {
            ...OLD_ENV,
            JWT_SECRET: 'supersecret',
            JWT_AUDIENCE: 'fakegaming-dashboard',
            JWT_ISSUER: 'fakegaming',
            API_URL: 'http://api.local',
            DASHBOARD_ADMINS: 'admin-id',
            SERVICE_API_TOKEN: 'svc-token'
        };
        fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });
        vi.stubGlobal('fetch', fetchMock);
        ({ GET, POST } = await import('../../../app/api/external/[...proxy]/route.js'));
    });

    afterEach(() => {
        process.env = { ...OLD_ENV };
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
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

    it('forwards service-authenticated dashboard admin assertions', async () => {
        const jwt = signTestJwt({ discordId: 'admin-id' }, 'supersecret');
        const res = await GET(
            makeReq({ method: 'GET', jwt, requestId: 'req-admin-1', search: '?guildId=guild-1' }),
            { params: Promise.resolve({ proxy: ['admin', 'riot-links'] }) } as any
        );

        expectOk(res);
        expect(fetchMock).toHaveBeenCalledWith('http://api.local/admin/riot-links?guildId=guild-1', expect.any(Object));
        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe(`Bearer ${jwt}`);
        expect(headers['x-service-token']).toBe('svc-token');
        expect(headers['x-dashboard-admin-user']).toBe('admin-id');
        expect(headers['x-dashboard-admin-request']).toBe('req-admin-1');
        expect(headers['x-dashboard-admin-signature']).toBe(
            createHmac('sha256', 'supersecret').update('admin-id:req-admin-1').digest('hex')
        );
    });
});
