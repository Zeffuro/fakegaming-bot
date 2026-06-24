import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signTestJwt, expectCreated, expectOk } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../vitest.setup.js';
import { getAniListAnimeById, type AniListTitle } from '@zeffuro/fakegaming-common/anime';

vi.mock('@zeffuro/fakegaming-common/anime', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@zeffuro/fakegaming-common/anime')>();
    return {
        ...actual,
        getAniListAnimeById: vi.fn(),
        searchAniListAnime: vi.fn(),
    };
});

const animeResult: AniListTitle = {
    id: 101,
    type: 'ANIME',
    title: {
        english: 'Frieren: Beyond Journey\'s End',
        romaji: 'Sousou no Frieren',
        native: null,
    },
    description: null,
    siteUrl: 'https://anilist.co/anime/101',
    coverImage: { large: null },
    bannerImage: null,
    format: 'TV',
    status: 'RELEASING',
    season: 'FALL',
    seasonYear: 2026,
    episodes: null,
    duration: 24,
    averageScore: 91,
    genres: ['Adventure'],
    nextAiringEpisode: { episode: 2, airingAt: 1782350000 },
    rankings: [],
    countryOfOrigin: 'JP',
    popularity: 1000,
} as AniListTitle;

describe('Anime subscriptions API', () => {
    let token: string;

    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });

    beforeEach(async () => {
        await configManager.animeManager.subscriptions.removeAll();
        await configManager.animeManager.titles.removeAll();
        vi.mocked(getAniListAnimeById).mockResolvedValue(animeResult);
    });

    it('subscribes the authenticated user to personal anime DM reminders', async () => {
        const res = await request(app)
            .post('/api/anime/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ anilistId: 101, reminderMinutes: 15 });

        expectCreated(res);
        expect(res.body).toMatchObject({ success: true, created: true, anilistId: 101 });

        const subscriptions = await configManager.animeManager.subscriptions.getUserSubscriptions('testuser');
        expect(subscriptions).toHaveLength(1);
        expect(subscriptions[0]).toMatchObject({
            anilistId: 101,
            targetType: 'dm',
            userId: 'testuser',
            guildId: null,
            channelId: null,
            reminderMinutes: 15,
        });

        const listRes = await request(app)
            .get('/api/anime')
            .set('Authorization', `Bearer ${token}`);

        expectOk(listRes);
        expect(listRes.body[0]).toMatchObject({
            anilistId: 101,
            targetType: 'dm',
            animeTitle: 'Frieren: Beyond Journey\'s End',
            reminderMinutes: 15,
        });
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
