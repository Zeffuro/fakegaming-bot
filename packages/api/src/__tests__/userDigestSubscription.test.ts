import { beforeEach, describe, expect, it } from 'vitest';
import { expectBadRequest, expectNotFound, expectOk, expectUnauthorized, givenAuthenticatedClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';

describe('User digest subscription API', () => {
    beforeEach(async () => {
        await configManager.userDigestSubscriptionManager.removeAll();
    });

    it('gets, creates, updates, and pauses the authenticated user digest subscription', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'digest-user' });

        const empty = await client.get('/api/userDigestSubscription');
        expectOk(empty);
        expect(empty.body.subscription).toBeNull();

        const created = await client.put('/api/userDigestSubscription', {
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            categories: ['reminders', 'anime'],
        });
        expectOk(created);
        expect(created.body.subscription).toMatchObject({
            discordId: 'digest-user',
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            categories: ['reminders', 'anime'],
            paused: false,
        });
        expect(created.body.subscription.nextRunAt).toBeGreaterThan(Date.now());

        const updated = await client.put('/api/userDigestSubscription', {
            frequency: 'weekly',
            timezone: 'Europe/Amsterdam',
            runAt: '08:30',
            dayOfWeek: 1,
            categories: ['reminders'],
        });
        expectOk(updated);
        expect(updated.body.subscription).toMatchObject({
            id: created.body.subscription.id,
            frequency: 'weekly',
            timezone: 'Europe/Amsterdam',
            dayOfWeek: 1,
        });

        const paused = await client.raw
            .patch('/api/userDigestSubscription/paused')
            .set('Authorization', `Bearer ${client.token}`)
            .send({ paused: true });
        expectOk(paused);
        expect(paused.body.subscription.paused).toBe(true);
    });

    it('does not expose subscriptions across users', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'digest-owner' });
        const other = givenAuthenticatedClient(app, { discordId: 'digest-other' });

        await owner.put('/api/userDigestSubscription', {
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
        });

        const otherList = await other.get('/api/userDigestSubscription');
        expectOk(otherList);
        expect(otherList.body.subscription).toBeNull();

        expectNotFound(await other.raw
            .patch('/api/userDigestSubscription/paused')
            .set('Authorization', `Bearer ${other.token}`)
            .send({ paused: true }));
    });

    it('validates schedules and requires authentication', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'digest-user' });

        expectBadRequest(await client.put('/api/userDigestSubscription', {
            frequency: 'daily',
            timezone: 'Not/AZone',
            runAt: '09:00',
        }));
        expectBadRequest(await client.put('/api/userDigestSubscription', {
            frequency: 'weekly',
            timezone: 'UTC',
            runAt: '25:00',
        }));

        const noAuth = await client.raw.get('/api/userDigestSubscription');
        expectUnauthorized(noAuth);
    });
});
