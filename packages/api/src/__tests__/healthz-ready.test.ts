import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { expectOk } from '@zeffuro/fakegaming-common/testing';

// Ensure test DB provider is set (vitest.setup.ts sets this globally as well)
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.NODE_ENV = 'test';

describe('health and readiness endpoints', () => {
    it('GET /healthz returns ok', async () => {
        const res = await request(app).get('/healthz');
        expectOk(res);
        expect(res.body).toEqual({ ok: true });
    });

    it('GET /ready returns ok when DB is available', async () => {
        const res = await request(app).get('/ready');
        expectOk(res);
        expect(res.body).toEqual({ ok: true });
    });
});
