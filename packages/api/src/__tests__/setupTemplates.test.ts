import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signTestJwt, expectCreated, expectNotFound, expectOk } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../vitest.setup.js';

describe('Setup templates API', () => {
    let token: string;

    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });

    beforeEach(async () => {
        await configManager.auditEventManager.removeAll();
        await configManager.twitchManager.removeAll();
        await configManager.youtubeManager.removeAll();
        await configManager.patchSubscriptionManager.removeAll();
        await configManager.animeManager.subscriptions.removeAll();
        await configManager.steamNewsSubscriptionManager.removeAll();
    });

    it('lists server-owned setup templates', async () => {
        const res = await request(app)
            .get('/api/setupTemplates')
            .set('Authorization', `Bearer ${token}`);

        expectOk(res);
        expect(res.body.templates).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'streamer-alerts', name: 'Streamer Alerts' }),
            expect.objectContaining({ id: 'patch-notes', name: 'Patch Notes' }),
            expect.objectContaining({ id: 'anime-club', name: 'Anime Club' }),
            expect.objectContaining({ id: 'gaming-community', name: 'Gaming Community' }),
        ]));
    });

    it('previews ready and duplicate patch-note routes without writing', async () => {
        await configManager.patchSubscriptionManager.addPlain({
            game: 'League of Legends',
            channelId: 'patch-channel',
            guildId: 'testguild1',
            paused: false,
        });

        const res = await request(app)
            .post('/api/setupTemplates/patch-notes/preview')
            .set('Authorization', `Bearer ${token}`)
            .send({
                guildId: 'testguild1',
                channels: { patches: 'patch-channel' },
                inputs: { patchGames: ['League of Legends', 'Valorant'] },
            });

        expectOk(res);
        expect(res.body.totals).toMatchObject({ records: 2, ready: 1, duplicate: 1, invalid: 0 });
        expect(res.body.ready[0].record).toMatchObject({ provider: 'Patch Notes', source: 'Valorant' });
        expect(res.body.skipped[0]).toMatchObject({
            reason: 'duplicate',
            record: expect.objectContaining({ source: 'League of Legends' }),
        });

        const records = await configManager.patchSubscriptionManager.getManyPlain({ guildId: 'testguild1' });
        expect(records).toHaveLength(1);
    });

    it('treats Twitch and YouTube sources as occupied across channels', async () => {
        await configManager.twitchManager.addPlain({
            twitchUsername: 'existingstreamer',
            discordChannelId: 'old-live-channel',
            guildId: 'testguild1',
            paused: false,
            isLive: false,
        });

        const res = await request(app)
            .post('/api/setupTemplates/streamer-alerts/preview')
            .set('Authorization', `Bearer ${token}`)
            .send({
                guildId: 'testguild1',
                channels: { live: 'new-live-channel' },
                inputs: { twitchUsernames: ['existingstreamer', 'newstreamer'] },
            });

        expectOk(res);
        expect(res.body.totals).toMatchObject({ ready: 1, duplicate: 1 });
        expect(res.body.ready[0].record.source).toBe('newstreamer');
        expect(res.body.skipped[0].message).toContain('applying would update its channel');
    });

    it('applies ready routes and records an aggregate audit event', async () => {
        const res = await request(app)
            .post('/api/setupTemplates/gaming-community/apply')
            .set('Authorization', `Bearer ${token}`)
            .send({
                guildId: 'testguild1',
                channels: {
                    patches: 'patch-channel',
                    anime: 'anime-channel',
                    steamNews: 'steam-channel',
                },
                inputs: {
                    patchGames: ['Valorant'],
                    animeIds: [154587],
                    steamApps: [{ appId: 730, name: 'Counter-Strike 2' }],
                },
            });

        expectCreated(res);
        expect(res.body.applied).toBe(3);
        expect(res.body.totals).toMatchObject({ ready: 3, duplicate: 0, invalid: 0 });

        await expect(configManager.patchSubscriptionManager.getManyPlain({ guildId: 'testguild1' })).resolves.toEqual([
            expect.objectContaining({ game: 'Valorant', channelId: 'patch-channel' }),
        ]);
        await expect(configManager.animeManager.subscriptions.getGuildChannelSubscriptions('testguild1')).resolves.toEqual([
            expect.objectContaining({ anilistId: 154587, channelId: 'anime-channel', reminderMinutes: 30 }),
        ]);
        await expect(configManager.steamNewsSubscriptionManager.getManyPlain({ guildId: 'testguild1' })).resolves.toEqual([
            expect.objectContaining({ steamAppId: 730, appName: 'Counter-Strike 2', discordChannelId: 'steam-channel' }),
        ]);

        const auditEvents = await configManager.auditEventManager.list({
            action: 'setupTemplate.apply',
            guildId: 'testguild1',
        });
        expect(auditEvents.total).toBe(1);
        expect(auditEvents.events[0]?.metadata).toMatchObject({
            applied: 3,
            ready: 3,
            skipped: 0,
        });
    });

    it('returns 404 for an unknown template', async () => {
        const res = await request(app)
            .post('/api/setupTemplates/not-real/preview')
            .set('Authorization', `Bearer ${token}`)
            .send({ guildId: 'testguild1', channels: {}, inputs: {} });

        expectNotFound(res);
    });
});
