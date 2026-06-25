import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { expectOk, givenAuthenticatedClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';

const originalDashboardAdmins = process.env.DASHBOARD_ADMINS;

beforeEach(async () => {
    process.env.DASHBOARD_ADMINS = 'admin-user';
    await configManager.auditEventManager.removeAll();
});

afterEach(() => {
    if (originalDashboardAdmins === undefined) {
        delete process.env.DASHBOARD_ADMINS;
    } else {
        process.env.DASHBOARD_ADMINS = originalDashboardAdmins;
    }
});

describe('Audit events API', () => {
    const admin = givenAuthenticatedClient(app, { discordId: 'admin-user' });

    it('filters Riot integration audit events by provider', async () => {
        await configManager.auditEventManager.record({
            actorId: 'user-1',
            action: 'riot.leagueForm',
            targetType: 'riotRecentForm',
            targetId: 'EUW',
            guildId: 'guild-1',
            metadata: {
                provider: 'riot',
                outcome: 'history_failure',
                errorCategory: 'rate_limited',
            },
        });
        await configManager.auditEventManager.record({
            actorId: 'user-2',
            action: 'riotLink.upsert',
            targetType: 'riotLink',
            targetId: 'user-2',
            guildId: 'guild-1',
        });
        await configManager.auditEventManager.record({
            actorId: 'user-3',
            action: 'twitch.update',
            targetType: 'twitchConfig',
            targetId: '1',
            guildId: 'guild-1',
        });

        const res = await admin.get('/api/auditEvents?provider=riot');

        expectOk(res);
        expect(res.body.total).toBe(1);
        expect(res.body.events).toEqual([
            expect.objectContaining({
                action: 'riot.leagueForm',
                targetType: 'riotRecentForm',
                targetId: 'EUW',
                metadata: expect.objectContaining({
                    provider: 'riot',
                    outcome: 'history_failure',
                    errorCategory: 'rate_limited',
                }),
            }),
        ]);
    });
});
