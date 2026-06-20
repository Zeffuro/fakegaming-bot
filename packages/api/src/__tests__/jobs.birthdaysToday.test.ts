import '../vitest.setup.js';
import { afterAll, beforeEach, describe, it, expect } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectOk, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';

const ORIGINAL_DASHBOARD_ADMINS = process.env.DASHBOARD_ADMINS;

describe('Jobs — birthdays today stat', () => {
    const client = givenAuthenticatedClient(app, { discordId: 'testuser' });

    beforeEach(() => {
        process.env.DASHBOARD_ADMINS = 'testuser';
    });

    afterAll(() => {
        if (ORIGINAL_DASHBOARD_ADMINS === undefined) {
            delete process.env.DASHBOARD_ADMINS;
        } else {
            process.env.DASHBOARD_ADMINS = ORIGINAL_DASHBOARD_ADMINS;
        }
    });

    it('GET /api/jobs/birthdays/today returns a processed count', async () => {
        const res = await client.get('/api/jobs/birthdays/today');
        expectOk(res);
        expect(typeof res.body.processed).toBe('number');
        expect(res.body.processed).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/jobs/birthdays/today without JWT returns 401', async () => {
        const res = await client.raw.get('/api/jobs/birthdays/today');
        expectUnauthorized(res);
    });
});

