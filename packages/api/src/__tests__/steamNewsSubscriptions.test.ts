import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectBadRequest, expectCreated, expectNotFound, expectOk, expectUnauthorized, signTestJwt } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const guildId = 'testguild1';

beforeEach(async () => {
    await configManager.steamNewsSubscriptionManager.removeAll();
    await configManager.integrationHealthManager.removeAll();
});

describe('Steam news subscriptions API', () => {
    const client = givenAuthenticatedClient(app);
    const token = signTestJwt({ discordId: 'testuser' });

    it('creates and lists guild-scoped Steam news subscriptions', async () => {
        const created = await client.post('/api/steamNewsSubscriptions', {
            steamAppId: 730,
            appName: 'Counter-Strike 2',
            discordChannelId: 'channel-steam',
            guildId,
            customMessage: 'Game update',
            cooldownMinutes: 20,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
        });

        expectCreated(created);
        expect(created.body).toMatchObject({
            steamAppId: 730,
            appName: 'Counter-Strike 2',
            discordChannelId: 'channel-steam',
            guildId,
            customMessage: 'Game update',
            cooldownMinutes: 20,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
            paused: false,
        });

        const list = await client.get('/api/steamNewsSubscriptions').query({ guildId });
        expectOk(list);
        expect(list.body).toHaveLength(1);
        expect(list.body[0]).toMatchObject({
            steamAppId: 730,
            discordChannelId: 'channel-steam',
            guildId,
        });
    });

    it('upserts subscriptions by guild, Steam app, and Discord channel', async () => {
        const first = await client.put('/api/steamNewsSubscriptions', {
            steamAppId: 440,
            appName: 'Team Fortress 2',
            discordChannelId: 'channel-steam',
            guildId,
            paused: true,
        });
        expectOk(first);
        expect(first.body.success).toBe(true);

        const second = await client.put('/api/steamNewsSubscriptions', {
            steamAppId: 440,
            appName: 'TF2',
            discordChannelId: 'channel-steam',
            guildId,
            paused: false,
        });
        expectOk(second);

        const list = await client.get('/api/steamNewsSubscriptions').query({ guildId });
        expectOk(list);
        expect(list.body).toHaveLength(1);
        expect(list.body[0]).toMatchObject({
            steamAppId: 440,
            appName: 'TF2',
            paused: false,
        });
    });

    it('pauses and resumes subscriptions while updating health status', async () => {
        const subscription = await configManager.steamNewsSubscriptionManager.addPlain({
            steamAppId: 570,
            appName: 'Dota 2',
            discordChannelId: 'channel-steam',
            guildId,
        });

        const paused = await request(app)
            .patch(`/api/steamNewsSubscriptions/${subscription.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ paused: true });
        expectOk(paused);
        expect(paused.body.paused).toBe(true);

        const healthAfterPause = await configManager.integrationHealthManager.list({
            provider: 'steamnews',
            guildId,
        });
        expect(healthAfterPause.records[0]).toMatchObject({
            provider: 'steamnews',
            configId: String(subscription.id),
            status: 'paused',
        });

        const resumed = await request(app)
            .patch(`/api/steamNewsSubscriptions/${subscription.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ paused: false });
        expectOk(resumed);
        expect(resumed.body.paused).toBe(false);
    });

    it('rejects invalid requests and missing records', async () => {
        const invalidCreate = await client.post('/api/steamNewsSubscriptions', {
            steamAppId: 0,
            discordChannelId: 'channel-steam',
            guildId,
        });
        expectBadRequest(invalidCreate);

        const invalidPatch = await request(app)
            .patch('/api/steamNewsSubscriptions/abc')
            .set('Authorization', `Bearer ${token}`)
            .send({ paused: true });
        expectBadRequest(invalidPatch);

        const missing = await client.get('/api/steamNewsSubscriptions/999999');
        expectNotFound(missing);
    });

    it('deletes subscriptions and requires auth for mutations', async () => {
        const subscription = await configManager.steamNewsSubscriptionManager.addPlain({
            steamAppId: 271590,
            appName: 'Grand Theft Auto V Legacy',
            discordChannelId: 'channel-steam',
            guildId,
        });

        const unauthenticated = await client.raw.post('/api/steamNewsSubscriptions').send({
            steamAppId: 730,
            discordChannelId: 'channel-steam',
            guildId,
        });
        expectUnauthorized(unauthenticated);

        const deleted = await client.delete(`/api/steamNewsSubscriptions/${subscription.id}`);
        expectOk(deleted);
        expect(deleted.body.success).toBe(true);

        const missing = await client.get(`/api/steamNewsSubscriptions/${subscription.id}`);
        expectNotFound(missing);
    });
});
