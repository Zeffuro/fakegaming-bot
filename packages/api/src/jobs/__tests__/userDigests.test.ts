import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

const mocks = vi.hoisted(() => ({
    listDue: vi.fn(),
    markRun: vi.fn(),
    scheduleRetry: vi.fn(),
    getRemindersByUser: vi.fn(),
    getAnimeSubscriptions: vi.fn(),
    getAnimeTitle: vi.fn(),
    sendDirectMessage: vi.fn(),
    recordJobRun: vi.fn(),
}));

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        userDigestSubscriptionManager: {
            listDue: mocks.listDue,
            markRun: mocks.markRun,
            scheduleRetry: mocks.scheduleRetry,
        },
        reminderManager: {
            getRemindersByUser: mocks.getRemindersByUser,
        },
        animeManager: {
            subscriptions: {
                getUserSubscriptions: mocks.getAnimeSubscriptions,
            },
            titles: {
                getOnePlain: mocks.getAnimeTitle,
            },
        },
    }),
}));

vi.mock('../../utils/discord.js', () => ({
    sendDirectMessage: mocks.sendDirectMessage,
}));

vi.mock('../status.js', () => ({
    recordJobRun: mocks.recordJobRun,
}));

import { buildReminderDigestContent, registerUserDigestJobs } from '../userDigests.js';

describe('user digest jobs', () => {
    const now = Date.parse('2026-06-23T09:00:00.000Z');

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(now);
        vi.clearAllMocks();
        mocks.getAnimeSubscriptions.mockResolvedValue([]);
        mocks.getAnimeTitle.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sends reminder digest DMs and advances the next run', async () => {
        mocks.listDue.mockResolvedValue([
            {
                id: 'digest-1',
                discordId: 'user-1',
                frequency: 'daily',
                timezone: 'UTC',
                runAt: '09:00',
                categories: '["reminders"]',
                nextRunAt: now,
            },
        ]);
        mocks.getRemindersByUser.mockResolvedValue([
            { id: 'reminder-1', userId: 'user-1', message: 'Deploy', timestamp: now + 60_000 },
            { id: 'reminder-2', userId: 'user-1', message: 'Paused', timestamp: now + 120_000, completed: true },
        ]);
        mocks.sendDirectMessage.mockResolvedValue({ id: 'discord-message' });

        const queue = new TestJobQueue();
        await registerUserDigestJobs(queue as never, new Date(now));
        const { done } = await runJobHandler(queue, 'user-digests:run', {});

        expect(done).toHaveBeenCalled();
        expect(mocks.sendDirectMessage).toHaveBeenCalledWith('user-1', expect.stringContaining('Daily reminder digest'));
        expect(mocks.sendDirectMessage).toHaveBeenCalledWith('user-1', expect.stringContaining('Deploy'));
        expect(mocks.sendDirectMessage).not.toHaveBeenCalledWith('user-1', expect.stringContaining('Paused'));
        expect(mocks.markRun).toHaveBeenCalledWith('digest-1', expect.objectContaining({
            lastRunAt: now,
            lastSentAt: now,
            nextRunAt: expect.any(Number),
        }));
        expect(mocks.scheduleRetry).not.toHaveBeenCalled();
    });

    it('skips empty digests but still advances the schedule', async () => {
        mocks.listDue.mockResolvedValue([
            {
                id: 'digest-empty',
                discordId: 'user-empty',
                frequency: 'weekly',
                timezone: 'UTC',
                runAt: '09:00',
                dayOfWeek: 2,
                categories: '["reminders"]',
                nextRunAt: now,
            },
        ]);
        mocks.getRemindersByUser.mockResolvedValue([]);

        const queue = new TestJobQueue();
        await registerUserDigestJobs(queue as never, new Date(now));
        await runJobHandler(queue, 'user-digests:run', {});

        expect(mocks.sendDirectMessage).not.toHaveBeenCalled();
        expect(mocks.markRun).toHaveBeenCalledWith('digest-empty', expect.objectContaining({
            lastRunAt: now,
            nextRunAt: expect.any(Number),
        }));
        const update = mocks.markRun.mock.calls[0]?.[1] as { lastSentAt?: number };
        expect(Object.hasOwn(update, 'lastSentAt')).toBe(false);
    });

    it('backs off failed digest DMs', async () => {
        mocks.listDue.mockResolvedValue([
            {
                id: 'digest-fail',
                discordId: 'user-fail',
                frequency: 'daily',
                timezone: 'UTC',
                runAt: '09:00',
                categories: '["reminders"]',
                nextRunAt: now,
            },
        ]);
        mocks.getRemindersByUser.mockResolvedValue([
            { id: 'reminder-1', userId: 'user-fail', message: 'Deploy', timestamp: now + 60_000 },
        ]);
        mocks.sendDirectMessage.mockResolvedValue(null);

        const queue = new TestJobQueue();
        await registerUserDigestJobs(queue as never, new Date(now));
        await runJobHandler(queue, 'user-digests:run', {});

        expect(mocks.markRun).not.toHaveBeenCalled();
        expect(mocks.scheduleRetry).toHaveBeenCalledWith('digest-fail', now + 15 * 60 * 1000);
    });

    it('sends personal anime reminder digests', async () => {
        mocks.listDue.mockResolvedValue([
            {
                id: 'digest-anime',
                discordId: 'user-anime',
                frequency: 'daily',
                timezone: 'UTC',
                runAt: '09:00',
                categories: '["anime"]',
                nextRunAt: now,
            },
        ]);
        mocks.getAnimeSubscriptions.mockResolvedValue([
            { id: 1, anilistId: 101, targetType: 'dm', userId: 'user-anime', reminderMinutes: 30 },
            { id: 2, anilistId: 102, targetType: 'dm', userId: 'user-anime', reminderMinutes: 30, paused: true },
            { id: 3, anilistId: 103, targetType: 'dm', userId: 'user-anime', reminderMinutes: 30 },
        ]);
        mocks.getAnimeTitle.mockImplementation(async ({ anilistId }: { anilistId: number }) => {
            if (anilistId === 101) {
                return {
                    anilistId,
                    titleEnglish: 'Frieren',
                    nextEpisode: 12,
                    nextAiringAt: now + 2 * 60 * 60 * 1000,
                };
            }
            if (anilistId === 103) {
                return {
                    anilistId,
                    titleEnglish: 'Later Show',
                    nextEpisode: 5,
                    nextAiringAt: now + 3 * 24 * 60 * 60 * 1000,
                };
            }
            return null;
        });
        mocks.sendDirectMessage.mockResolvedValue({ id: 'discord-message' });

        const queue = new TestJobQueue();
        await registerUserDigestJobs(queue as never, new Date(now));
        await runJobHandler(queue, 'user-digests:run', {});

        expect(mocks.getRemindersByUser).not.toHaveBeenCalled();
        expect(mocks.sendDirectMessage).toHaveBeenCalledWith('user-anime', expect.stringContaining('Daily personal digest'));
        expect(mocks.sendDirectMessage).toHaveBeenCalledWith('user-anime', expect.stringContaining('Anime reminders'));
        expect(mocks.sendDirectMessage).toHaveBeenCalledWith('user-anime', expect.stringContaining('Frieren episode 12'));
        expect(mocks.sendDirectMessage).not.toHaveBeenCalledWith('user-anime', expect.stringContaining('Later Show'));
        expect(mocks.markRun).toHaveBeenCalledWith('digest-anime', expect.objectContaining({
            lastRunAt: now,
            lastSentAt: now,
            nextRunAt: expect.any(Number),
        }));
    });

    it('formats reminder digest content with a bounded list', () => {
        const content = buildReminderDigestContent({
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            windowEndsAt: now + 24 * 60 * 60 * 1000,
            reminders: Array.from({ length: 11 }, (_, index) => ({
                id: `reminder-${index}`,
                message: `Reminder ${index}`,
                timestamp: now + index * 60_000,
            })),
        });

        expect(content).toContain('Daily reminder digest');
        expect(content).toContain('Reminder 0');
        expect(content).toContain('...and 1 more.');
    });
});
