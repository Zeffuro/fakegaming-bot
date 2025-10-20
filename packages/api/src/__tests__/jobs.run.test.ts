import '../vitest.setup.js';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { vi } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import request from 'supertest';
import { expectForbidden, expectOk, expectAccepted } from '@zeffuro/fakegaming-common/testing';

// Mock the active job queue
const schedule = vi.fn(async (_name: string, _data: unknown) => 'job-1');
vi.mock('../jobs/bootstrap.js', () => ({
    getActiveJobQueue: () => ({ schedule }),
    getLastHeartbeat: () => null,
}));

// Ensure production gating and admin list during these tests
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_ADMINS = process.env.DASHBOARD_ADMINS;
const ORIGINAL_SVC = process.env.INTERNAL_API_TOKEN;

describe('Jobs run route', () => {
    const _admin = givenAuthenticatedClient(app, { discordId: 'testadmin' });

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.DASHBOARD_ADMINS = 'testadmin';
        process.env.INTERNAL_API_TOKEN = 'svc-token';
        schedule.mockClear();
    });

    afterAll(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
        process.env.DASHBOARD_ADMINS = ORIGINAL_ADMINS;
        process.env.INTERNAL_API_TOKEN = ORIGINAL_SVC;
    });

    it('POST /api/jobs/birthdays/run passes date and force when supported', async () => {
        const body = { date: '2025-01-01T00:00:00.000Z', force: true };
        const res = await request(app)
            .post('/api/jobs/birthdays/run')
            .set('x-service-token', 'svc-token')
            .send(body);
        expectAccepted(res);
        const call = schedule.mock.calls.at(0);
        expect(call).toBeTruthy();
        const [_name, payload] = call as [string, Record<string, unknown>];
        expect(_name).toBe('birthdays:run');
        expect(payload.date).toBe(body.date);
        expect(payload.force).toBe(true);
    });

    it('POST /api/jobs/reminders/run ignores date/force payload', async () => {
        const res = await request(app)
            .post('/api/jobs/reminders/run')
            .set('x-service-token', 'svc-token')
            .send({ date: '2025-01-01T00:00:00.000Z', force: true });
        expectAccepted(res);
        const call = schedule.mock.calls.at(0);
        expect(call).toBeTruthy();
        const [_name, payload] = call as [string, Record<string, unknown>];
        expect(_name).toBe('reminders:run');
        expect(Object.keys(payload).length).toBe(0);
    });

    it('GET /api/jobs returns 403 in production for non-admin user', async () => {
        const nonAdmin = givenAuthenticatedClient(app, { discordId: 'someoneelse' });
        const res = await nonAdmin.get('/api/jobs');
        expectForbidden(res);
        expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('GET /api/jobs is allowed for service-authenticated request without JWT', async () => {
        process.env.INTERNAL_API_TOKEN = 'svc-token';
        const res = await request(app)
            .get('/api/jobs')
            .set('x-service-token', 'svc-token');
        expectOk(res);
        expect(Array.isArray(res.body.jobs)).toBe(true);
    });
});
