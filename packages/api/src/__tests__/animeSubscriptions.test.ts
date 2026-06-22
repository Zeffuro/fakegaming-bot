import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signTestJwt, expectOk } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../vitest.setup.js';

describe('Anime subscriptions API', () => {
    let token: string;

    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });

    it('pauses and resumes an anime channel subscription by id', async () => {
        const created = await configManager.animeManager.subscriptions.addPlain({
            anilistId: 101,
            targetType: 'channel',
            guildId: 'testguild1',
            channelId: 'anime-channel-1',
            userId: null,
            reminderMinutes: 30,
            lastNotifiedEpisode: null,
            lastNotifiedAiringAt: null,
            paused: false,
        });

        const pauseRes = await request(app)
            .patch(`/api/anime/${created.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ paused: true });
        expectOk(pauseRes);
        expect(pauseRes.body.paused).toBe(true);
        expect(pauseRes.body.discordChannelId).toBe('anime-channel-1');

        const resumeRes = await request(app)
            .patch(`/api/anime/${created.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ paused: false });
        expectOk(resumeRes);
        expect(resumeRes.body.paused).toBe(false);
    });
});
