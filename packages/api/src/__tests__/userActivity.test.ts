import { beforeEach, describe, expect, it } from 'vitest';
import { expectOk, expectUnauthorized, givenAuthenticatedClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';

describe('User activity API', () => {
    beforeEach(async () => {
        await configManager.auditEventManager.removeAll();
        await configManager.notificationsManager.removeAll();
    });

    it('returns authenticated user audit events and matching birthday deliveries', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'activity-user' });
        await configManager.auditEventManager.record({
            actorId: 'activity-user',
            action: 'userReminder.create',
            targetType: 'reminder',
            targetId: 'reminder-1',
            timestamp: new Date('2026-06-24T10:00:00.000Z'),
        });
        await configManager.auditEventManager.record({
            actorId: 'other-user',
            action: 'userReminder.create',
            targetType: 'reminder',
            targetId: 'reminder-other',
            timestamp: new Date('2026-06-24T11:00:00.000Z'),
        });
        await configManager.notificationsManager.recordIfNew({
            provider: 'birthday',
            eventId: 'guild-1:activity-user:2026-06-24',
            guildId: 'guild-1',
            channelId: 'channel-1',
        });
        await configManager.notificationsManager.recordIfNew({
            provider: 'birthday',
            eventId: 'guild-2:other-user:2026-06-24',
            guildId: 'guild-2',
            channelId: 'channel-2',
        });

        const res = await client.get('/api/userActivity?auditLimit=5&deliveryLimit=5');

        expectOk(res);
        expect(res.body.summary).toEqual({
            auditTotal: 1,
            deliveryTotal: 1,
        });
        expect(res.body.auditEvents).toEqual([
            expect.objectContaining({
                actorId: 'activity-user',
                action: 'userReminder.create',
                targetId: 'reminder-1',
                timestamp: '2026-06-24T10:00:00.000Z',
            }),
        ]);
        expect(res.body.deliveries).toEqual([
            expect.objectContaining({
                provider: 'birthday',
                eventId: 'guild-1:activity-user:2026-06-24',
                guildId: 'guild-1',
                channelId: 'channel-1',
            }),
        ]);
    });

    it('requires authentication', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'activity-user' });

        expectUnauthorized(await client.raw.get('/api/userActivity'));
    });
});
