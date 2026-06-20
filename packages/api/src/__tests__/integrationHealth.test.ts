import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectForbidden, expectOk, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const guildId = 'testguild1';
const originalDashboardAdmins = process.env.DASHBOARD_ADMINS;

beforeEach(async () => {
    await configManager.integrationHealthManager.removeAll();
});

afterEach(() => {
    if (originalDashboardAdmins === undefined) {
        delete process.env.DASHBOARD_ADMINS;
    } else {
        process.env.DASHBOARD_ADMINS = originalDashboardAdmins;
    }
});

describe('Integration health API', () => {
    const client = givenAuthenticatedClient(app);
    const admin = givenAuthenticatedClient(app, { discordId: 'admin-user' });
    const regularUser = givenAuthenticatedClient(app, { discordId: 'regular-user' });

    it('returns guild-scoped provider health records', async () => {
        await configManager.integrationHealthManager.recordSuccess({
            provider: 'twitch',
            configId: 1,
            guildId,
            channelId: 'chan-1',
            delivered: true,
            checkedAt: new Date('2026-06-20T12:00:00.000Z'),
        });
        await configManager.integrationHealthManager.recordFailure({
            provider: 'youtube',
            configId: 2,
            guildId,
            channelId: 'chan-2',
            errorCode: 'YOUTUBE_FEED_UNAVAILABLE',
            errorMessage: 'Feed unavailable',
        });

        const res = await client.get(`/api/integrationHealth?guildId=${guildId}&provider=twitch`);

        expectOk(res);
        expect(res.body.records).toHaveLength(1);
        expect(res.body.records[0]).toMatchObject({
            provider: 'twitch',
            configId: '1',
            guildId,
            channelId: 'chan-1',
            status: 'healthy',
            consecutiveFailures: 0,
            lastErrorCode: null,
        });
        expect(res.body.records[0].lastCheckedAt).toBe('2026-06-20T12:00:00.000Z');
        expect(res.body.records[0].lastDeliveryAt).toBe('2026-06-20T12:00:00.000Z');
    });

    it('requires authentication', async () => {
        const res = await client.raw.get(`/api/integrationHealth?guildId=${guildId}`);

        expectUnauthorized(res);
    });

    it('lists admin health records with status summaries', async () => {
        process.env.DASHBOARD_ADMINS = 'admin-user';
        await configManager.integrationHealthManager.recordSuccess({
            provider: 'twitch',
            configId: 1,
            guildId,
            channelId: 'chan-1',
        });
        await configManager.integrationHealthManager.recordFailure({
            provider: 'youtube',
            configId: 2,
            guildId,
            channelId: 'chan-2',
            errorCode: 'YOUTUBE_FEED_UNAVAILABLE',
            errorMessage: 'Feed unavailable',
        });

        const res = await admin.get('/api/integrationHealth/admin').query({ guildId, status: 'error' });

        expectOk(res);
        expect(res.body.total).toBe(1);
        expect(res.body.records).toHaveLength(1);
        expect(res.body.records[0]).toMatchObject({
            provider: 'youtube',
            configId: '2',
            status: 'error',
        });
        expect(res.body.summary).toMatchObject({
            total: 2,
            healthy: 1,
            error: 1,
        });
    });

    it('requires dashboard admin access for the admin health list', async () => {
        process.env.DASHBOARD_ADMINS = 'admin-user';

        const res = await regularUser.get('/api/integrationHealth/admin');

        expectForbidden(res);
    });
});
