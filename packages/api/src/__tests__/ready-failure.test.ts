import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import { expectServiceUnavailable } from '@zeffuro/fakegaming-common/testing';

// Ensure test DB provider is set; though we will mock getSequelize
process.env.NODE_ENV = 'test';

// Reset module registry between tests so mocks apply to fresh imports
beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('readiness endpoint failure path', () => {
    it('GET /ready returns 503 when DB authenticate fails', async () => {
        // Mock common module but keep actual exports where possible
        vi.doMock('@zeffuro/fakegaming-common', async () => {
            const actual = await vi.importActual<typeof import('@zeffuro/fakegaming-common')>('@zeffuro/fakegaming-common');
            return {
                ...actual,
                getSequelize: () => ({
                    authenticate: async () => { throw new Error('forced-auth-failure'); }
                } as any),
            };
        });

        const app = (await import('../app.js')).default;
        const res = await request(app).get('/ready');
        expectServiceUnavailable(res);
        expect(res.body).toEqual({ ok: false, error: { code: 'DB_UNAVAILABLE' } });
    });
});
