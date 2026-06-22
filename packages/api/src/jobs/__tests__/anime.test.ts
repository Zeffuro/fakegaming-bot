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

import { registerAnimeJobs } from '../anime.js';

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
        hoisted.getAniListNextAiring.mockResolvedValue([]);
        hoisted.getAllPlain.mockResolvedValue([]);
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
});
