import '../vitest.setup.js';
import { describe, it, expect } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectOk, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';
import { recordJobRun } from '../jobs/status.js';

describe('Jobs status/read-only endpoints', () => {
    const client = givenAuthenticatedClient(app, { discordId: 'testuser' });

    it('GET /api/jobs should list allowed jobs', async () => {
        const res = await client.get('/api/jobs');
        expectOk(res);
        expect(Array.isArray(res.body.jobs)).toBe(true);
        const names = (res.body.jobs as Array<{ name: string }>).map(j => j.name);
        expect(names).toContain('birthdays');
        expect(names).toContain('heartbeat');
    });

    it('GET /api/jobs without JWT returns 401', async () => {
        const res = await client.raw.get('/api/jobs');
        expectUnauthorized(res);
    });

    it('GET /api/jobs/heartbeat/last returns null by default', async () => {
        const res = await client.get('/api/jobs/heartbeat/last');
        expectOk(res);
        expect(res.body).toHaveProperty('last');
        expect(res.body.last === null || typeof res.body.last === 'object').toBe(true);
    });

    it('GET /api/jobs/heartbeat/status returns runs after recording one', async () => {
        let res = await client.get('/api/jobs/heartbeat/status');
        expectOk(res);
        expect(Array.isArray(res.body.runs)).toBe(true);
        expect(res.body.runs.length).toBeGreaterThanOrEqual(0);

        // Simulate a heartbeat run
        const now = new Date().toISOString();
        recordJobRun('heartbeat', { startedAt: now, finishedAt: now, ok: true, meta: { backend: 'memory' } });

        res = await client.get('/api/jobs/heartbeat/status');
        expectOk(res);
        const runs = res.body.runs as Array<{ ok: boolean; meta?: Record<string, unknown> }>;
        expect(runs.length).toBeGreaterThan(0);
        expect(runs[0].ok).toBe(true);
        expect(runs[0].meta && (runs[0].meta as any).backend).toBe('memory');
    });

    it('POST /api/jobs/birthdays/run returns 503 when queue is unavailable', async () => {
        const res = await client.post('/api/jobs/birthdays/run').send({ force: true });
        expect(res.status).toBe(503);
        expect(res.body && res.body.error && res.body.error.code).toBe('JOBS_UNAVAILABLE');
    });
});

