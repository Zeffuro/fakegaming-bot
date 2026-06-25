import '../vitest.setup.js';
import { describe, it, beforeEach, afterAll, expect } from 'vitest';
import app from '../app.js';
import request from 'supertest';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectBadRequest, expectForbidden, expectOk } from '@zeffuro/fakegaming-common/testing';
import { JobRun } from '@zeffuro/fakegaming-common';
import { configManager } from '../vitest.setup.js';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_ADMINS = process.env.DASHBOARD_ADMINS;
const ORIGINAL_SVC = process.env.INTERNAL_API_TOKEN;

describe('Jobs routes error branches', () => {
    const admin = givenAuthenticatedClient(app, { discordId: 'testadmin' });
    const user = givenAuthenticatedClient(app, { discordId: 'someoneelse' });

    beforeEach(async () => {
        process.env.NODE_ENV = 'production';
        process.env.DASHBOARD_ADMINS = 'testadmin';
        process.env.INTERNAL_API_TOKEN = 'svc-token';
        await configManager.patchNoteHistoryManager.removeAll();
        await JobRun.destroy({ where: { name: 'patchnotes-scan' } });
    });

    afterAll(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
        process.env.DASHBOARD_ADMINS = ORIGINAL_ADMINS;
        process.env.INTERNAL_API_TOKEN = ORIGINAL_SVC;
    });

    it('GET unknown job status returns 400', async () => {
        const res = await admin.get('/api/jobs/not-a-job/status');
        expectBadRequest(res);
    });

    it('POST unknown job run returns 400', async () => {
        const res = await request(app).post('/api/jobs/not-a-job/run').set('x-service-token', 'svc-token').send({});
        expectBadRequest(res);
    });

    it('GET heartbeat last returns 403 for non-admin in production', async () => {
        const res = await user.get('/api/jobs/heartbeat/last');
        expectForbidden(res);
    });

    it('GET jobs list returns 200 for service-auth without JWT in production', async () => {
        const res = await request(app).get('/api/jobs').set('x-service-token', 'svc-token');
        expectOk(res);
    });

    it('GET patchnotes storage returns bounded history summary and latest scan metadata', async () => {
        await configManager.patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/patch-1',
            title: 'Patch 1',
            content: 'abcdef',
            publishedAt: new Date('2026-06-25T00:00:00.000Z').getTime(),
        }, { now: new Date('2026-06-25T00:00:00.000Z'), retentionDays: 3650 });
        await JobRun.create({
            name: 'patchnotes-scan',
            startedAt: new Date('2026-06-25T01:00:00.000Z'),
            finishedAt: new Date('2026-06-25T01:01:00.000Z'),
            ok: true,
            meta: {
                historyPrunedRows: 2,
                historyTruncated: 1,
            },
        });

        const res = await request(app).get('/api/jobs/patchnotes/storage').set('x-service-token', 'svc-token');

        expectOk(res);
        expect(res.body.totalRows).toBe(1);
        expect(res.body.totalContentBytes).toBe(6);
        expect(res.body.games).toEqual([
            expect.objectContaining({
                game: 'league',
                rows: 1,
                contentBytes: 6,
            }),
        ]);
        expect(res.body.lastScan).toEqual(expect.objectContaining({
            historyPrunedRows: 2,
            historyTruncated: 1,
            ok: true,
        }));
    });
});
