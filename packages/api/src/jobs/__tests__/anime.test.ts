import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

const hoisted = vi.hoisted(() => ({
    getAniListNextAiring: vi.fn(),
    getAllPlain: vi.fn(),
    updatePlain: vi.fn(),
    upsertTitle: vi.fn(),
    getOnePlain: vi.fn(),
    upsertEpisode: vi.fn(),
    removeByPk: vi.fn(),
    sendChannelMessagePayload: vi.fn(),
    sendDirectMessagePayload: vi.fn(),
    getGuildOutputLocale: vi.fn(),
    getPreferredLocale: vi.fn(),
}));

vi.mock('@zeffuro/fakegaming-common/anime', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@zeffuro/fakegaming-common/anime')>();
    return {
        ...actual,
        getAniListNextAiring: hoisted.getAniListNextAiring,
        mapAniListTitleToInput: vi.fn((media: { id: number }) => ({ anilistId: media.id })),
    };
});

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        animeManager: {
            subscriptions: {
                getAllPlain: hoisted.getAllPlain,
                updatePlain: hoisted.updatePlain,
                removeByPk: hoisted.removeByPk,
            },
            titles: {
                upsertTitle: hoisted.upsertTitle,
                getOnePlain: hoisted.getOnePlain,
            },
            episodes: {
                upsertEpisode: hoisted.upsertEpisode,
            },
        },
        guildLocaleConfigManager: {
            getOutputLocale: hoisted.getGuildOutputLocale,
        },
        userManager: {
            getPreferredLocale: hoisted.getPreferredLocale,
        },
    }),
}));

vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
vi.mock('../../utils/discord.js', () => ({
    sendChannelMessagePayload: hoisted.sendChannelMessagePayload,
    sendDirectMessagePayload: hoisted.sendDirectMessagePayload,
}));
vi.mock('@zeffuro/fakegaming-common/jobs', () => ({
    scheduleSingleton: vi.fn().mockResolvedValue('jobid'),
    formatMinuteKey: (d: Date) => `${d.getUTCFullYear()}${(d.getUTCMonth() + 1).toString().padStart(2, '0')}${d.getUTCDate().toString().padStart(2, '0')}${d.getUTCHours().toString().padStart(2, '0')}${d.getUTCMinutes().toString().padStart(2, '0')}`,
}));

import { buildAnimeReminderPayload, registerAnimeJobs } from '../anime.js';

describe('jobs/anime notifications', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        hoisted.getAniListNextAiring.mockReset();
        hoisted.getAllPlain.mockReset();
        hoisted.updatePlain.mockReset();
        hoisted.upsertTitle.mockReset();
        hoisted.getOnePlain.mockReset();
        hoisted.upsertEpisode.mockReset();
        hoisted.removeByPk.mockReset();
        hoisted.sendChannelMessagePayload.mockReset();
        hoisted.sendDirectMessagePayload.mockReset();
        hoisted.getGuildOutputLocale.mockReset();
        hoisted.getPreferredLocale.mockReset();
        hoisted.getAniListNextAiring.mockResolvedValue([]);
        hoisted.getAllPlain.mockResolvedValue([]);
        hoisted.getGuildOutputLocale.mockResolvedValue('en');
        hoisted.getPreferredLocale.mockResolvedValue('en');
    });

    it('builds English and Dutch payload framing without changing the provider title', () => {
        const item = {
            mediaId: 101,
            episode: 12,
            airingAt: 1_787_174_000,
            media: {
                title: { english: 'Frieren' },
                siteUrl: 'https://anilist.co/anime/101',
            },
        } as never;

        const english = buildAnimeReminderPayload(item, 'en') as { embeds: Array<Record<string, unknown>> };
        const dutch = buildAnimeReminderPayload(item, 'nl') as { embeds: Array<Record<string, unknown>> };

        expect(english.embeds[0]).toMatchObject({
            title: 'Frieren episode 12',
            description: 'Episode 12 airs <t:1787174000:R>.',
            author: { name: 'Anime reminder' },
        });
        expect(dutch.embeds[0]).toMatchObject({
            title: 'Frieren aflevering 12',
            description: 'Aflevering 12 wordt <t:1787174000:R> uitgezonden.',
            author: { name: 'Animeherinnering' },
        });
    });

    it('skips paused subscriptions before sending reminders', async () => {
        hoisted.getAllPlain.mockResolvedValue([{
            id: 1,
            anilistId: 101,
            targetType: 'channel',
            guildId: 'guild-1',
            channelId: 'channel-1',
            reminderMinutes: 30,
            paused: true,
        }]);
        const q = new TestJobQueue();

        await registerAnimeJobs(q as any, new Date('2025-01-01T00:00:00Z'));
        await runJobHandler(q, 'anime:notifications', {});

        expect(hoisted.getAniListNextAiring).toHaveBeenCalledWith([]);
        expect(hoisted.sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(hoisted.sendDirectMessagePayload).not.toHaveBeenCalled();
        expect(hoisted.updatePlain).not.toHaveBeenCalled();
    });

    it('uses the stored guild locale for channel reminders', async () => {
        const now = new Date('2026-08-19T12:00:00.000Z');
        vi.setSystemTime(now);
        hoisted.getGuildOutputLocale.mockResolvedValue('nl');
        hoisted.getAllPlain.mockResolvedValue([{
            id: 2,
            anilistId: 101,
            targetType: 'channel',
            guildId: 'guild-nl',
            channelId: 'channel-nl',
            reminderMinutes: 30,
            paused: false,
        }]);
        hoisted.getAniListNextAiring.mockResolvedValue([{
            mediaId: 101,
            episode: 12,
            airingAt: Math.floor(now.getTime() / 1000) + 60,
            media: { id: 101, title: { english: 'Frieren' } },
        }]);
        hoisted.sendChannelMessagePayload.mockResolvedValue({ id: 'message-1' });
        const q = new TestJobQueue();

        await registerAnimeJobs(q as never, now);
        await runJobHandler(q, 'anime:notifications', {});

        expect(hoisted.getGuildOutputLocale).toHaveBeenCalledWith('guild-nl');
        expect(hoisted.sendChannelMessagePayload).toHaveBeenCalledWith(
            'channel-nl',
            expect.objectContaining({
                embeds: [expect.objectContaining({ title: 'Frieren aflevering 12' })],
            }),
        );
    });
});
