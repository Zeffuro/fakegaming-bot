import '../vitest.setup.js';
import { describe, it, expect } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectOk, expectUnauthorized, expectServiceUnavailable, expectErrorCode } from '@zeffuro/fakegaming-common/testing';
import { cleanupJobRuns, recordJobRun } from '../jobs/status.js';
import { JobRun } from '@zeffuro/fakegaming-common';

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
        expectServiceUnavailable(res);
        expectErrorCode(res as any, 'JOBS_UNAVAILABLE');
    });

    it('cleanupJobRuns deletes old rows and caps rows per job', async () => {
        await JobRun.destroy({ where: { name: 'cleanup-test' } });
        const now = new Date();
        const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

        await JobRun.bulkCreate([
            { name: 'cleanup-test', startedAt: old, finishedAt: old, ok: true },
            { name: 'cleanup-test', startedAt: new Date(now.getTime() - 3000), finishedAt: new Date(now.getTime() - 3000), ok: true },
            { name: 'cleanup-test', startedAt: new Date(now.getTime() - 2000), finishedAt: new Date(now.getTime() - 2000), ok: true },
            { name: 'cleanup-test', startedAt: new Date(now.getTime() - 1000), finishedAt: new Date(now.getTime() - 1000), ok: true },
        ]);

        const result = await cleanupJobRuns({ retentionDays: 7, maxRowsPerJob: 2 });
        expect(result.deletedOlderThanRetention).toBeGreaterThanOrEqual(1);

        const remaining = await JobRun.findAll({
            where: { name: 'cleanup-test' },
            order: [['finishedAt', 'DESC']],
        });
        expect(remaining).toHaveLength(2);
    });
});
