import '../vitest.setup.js';
import { describe, it, beforeEach, afterAll } from 'vitest';
import app from '../app.js';
import request from 'supertest';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectBadRequest, expectForbidden, expectOk } from '@zeffuro/fakegaming-common/testing';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_ADMINS = process.env.DASHBOARD_ADMINS;
const ORIGINAL_SVC = process.env.INTERNAL_API_TOKEN;

describe('Jobs routes error branches', () => {
    const admin = givenAuthenticatedClient(app, { discordId: 'testadmin' });
    const user = givenAuthenticatedClient(app, { discordId: 'someoneelse' });

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.DASHBOARD_ADMINS = 'testadmin';
        process.env.INTERNAL_API_TOKEN = 'svc-token';
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
});
