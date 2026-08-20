import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signTestJwt, expectBadRequest, expectCreated, expectNotFound, expectOk } from '@zeffuro/fakegaming-common/testing';
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
        await configManager.animeManager.episodes.removeAll();
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

    it('returns a tokenized personal anime calendar feed', async () => {
        const airingAt = Date.now() + 86_400_000;
        await configManager.animeManager.titles.upsertTitle({
            anilistId: 101,
            titleEnglish: 'Frieren: Beyond Journey\'s End',
            siteUrl: 'https://anilist.co/anime/101',
            duration: 24,
        });
        await configManager.animeManager.episodes.upsertEpisode({
            anilistId: 101,
            episode: 2,
            airingAt,
        });
        await configManager.animeManager.subscriptions.subscribeUser({
            anilistId: 101,
            userId: 'testuser',
            reminderMinutes: 15,
        });
        await configManager.userManager.setUser({ discordId: 'testuser', preferredLocale: 'nl' });

        const linkRes = await request(app)
            .get('/api/anime/calendar')
            .set('Authorization', `Bearer ${token}`);

        expectOk(linkRes);
        expect(linkRes.body).toEqual(expect.objectContaining({
            path: expect.stringContaining('/api/anime/calendar.ics?token='),
            token: expect.any(String),
            url: expect.stringContaining('/api/anime/calendar.ics?token='),
        }));

        const feedRes = await request(app)
            .get(`/api/anime/calendar.ics?token=${encodeURIComponent(linkRes.body.token)}`);

        expectOk(feedRes);
        expect(feedRes.headers['content-type']).toContain('text/calendar');
        expect(feedRes.text).toContain('BEGIN:VCALENDAR');
        expect(feedRes.text).toContain("SUMMARY:Frieren: Beyond Journey's End Aflevering 2");
        expect(feedRes.text).toContain('X-WR-CALNAME:Fakegaming-animeherinneringen');
        expect(feedRes.text).toContain('Herinnering 15 minuten voor uitzending');
        expect(feedRes.text).toContain('UID:anime-101-2@fakegaming');
        expect(feedRes.text).toContain('PRODID:-//Fakegaming//Anime Calendar//EN');
        expect(feedRes.headers['content-disposition']).toBe('inline; filename="fakegaming-anime.ics"');
        expect(feedRes.text).toContain('DTSTART:');
        expect(feedRes.text).toContain('X-WR-TIMEZONE:UTC');
    });

    it('rejects invalid anime calendar tokens', async () => {
        const res = await request(app)
            .get('/api/anime/calendar.ics?token=invalid')
            .set('Accept-Language', 'nl');

        expectNotFound(res);
        expect(res.body.error.message).toBe('Kalender niet gevonden');
    });

    it('localizes AniList status values in not-subscribable errors', async () => {
        vi.mocked(getAniListAnimeById).mockResolvedValue({ ...animeResult, status: 'FINISHED' });

        const res = await request(app)
            .post('/api/anime/me')
            .set('Authorization', `Bearer ${token}`)
            .set('Accept-Language', 'nl')
            .send({ anilistId: 101, reminderMinutes: 15 });

        expectBadRequest(res);
        expect(res.body.error).toEqual({
            code: 'ANIME_NOT_SUBSCRIBABLE',
            message: "Je kunt Frieren: Beyond Journey's End niet volgen (status: afgerond).",
        });
    });
});
