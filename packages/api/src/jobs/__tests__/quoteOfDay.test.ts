import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

const mocks = vi.hoisted(() => ({
    listEnabledForHour: vi.fn(),
    getQuotesByGuild: vi.fn(),
    recordIfNew: vi.fn(),
    setMessageMeta: vi.fn(),
    getNotification: vi.fn(),
    sendChannelMessage: vi.fn(),
    recordJobRun: vi.fn(),
}));

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        quoteOfDayManager: {
            listEnabledForHour: mocks.listEnabledForHour,
        },
        quoteManager: {
            getQuotesByGuild: mocks.getQuotesByGuild,
        },
        notificationsManager: {
            recordIfNew: mocks.recordIfNew,
            setMessageMeta: mocks.setMessageMeta,
            getOnePlain: mocks.getNotification,
        },
    }),
}));

vi.mock('../../utils/discord.js', () => ({
    sendChannelMessage: mocks.sendChannelMessage,
}));

vi.mock('../status.js', () => ({
    recordJobRun: mocks.recordJobRun,
}));

import {
    buildQuoteOfDayContent,
    computeNextQuoteOfDayRunDelaySeconds,
    registerQuoteOfDayJobs,
    runQuoteOfDayOnce,
} from '../quoteOfDay.js';

describe('quote-of-the-day jobs', () => {
    const date = new Date('2026-06-24T09:15:00.000Z');

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listEnabledForHour.mockResolvedValue([
            { guildId: 'guild-1', channelId: 'channel-1', enabled: true, runHourUtc: 9 },
        ]);
        mocks.getQuotesByGuild.mockResolvedValue([
            { id: 'quote-1', guildId: 'guild-1', quote: 'Approved quote', authorId: 'author-1', submitterId: 'submitter-1', timestamp: 1, moderationStatus: 'approved' },
            { id: 'quote-2', guildId: 'guild-1', quote: 'Pending quote', authorId: 'author-2', submitterId: 'submitter-2', timestamp: 2, moderationStatus: 'pending' },
        ]);
        mocks.recordIfNew.mockResolvedValue({ created: true });
        mocks.sendChannelMessage.mockResolvedValue({ id: 'message-1' });
    });

    it('computes the next UTC hour boundary', () => {
        expect(computeNextQuoteOfDayRunDelaySeconds(new Date('2026-06-24T09:59:10.000Z'))).toBe(50);
    });

    it('formats quote-of-the-day content', () => {
        expect(buildQuoteOfDayContent({
            dateKey: '2026-06-24',
            quote: { id: 'quote-1', guildId: 'guild-1', quote: 'Ship it', authorId: 'author-1', submitterId: 'submitter-1', timestamp: 1 },
        })).toBe('Quote of the day (2026-06-24)\n"Ship it"\n- <@author-1>');
    });

    it('sends the selected approved quote and records delivery metadata', async () => {
        await expect(runQuoteOfDayOnce(date)).resolves.toEqual({
            processed: 1,
            sent: 1,
            skipped: 0,
            failures: 0,
        });

        expect(mocks.listEnabledForHour).toHaveBeenCalledWith(9);
        expect(mocks.recordIfNew).toHaveBeenCalledWith({
            provider: 'quoteofday',
            eventId: 'guild-1:2026-06-24',
            guildId: 'guild-1',
            channelId: 'channel-1',
        });
        expect(mocks.sendChannelMessage).toHaveBeenCalledWith('channel-1', expect.stringContaining('Approved quote'));
        expect(mocks.setMessageMeta).toHaveBeenCalledWith('quoteofday', 'guild-1:2026-06-24', {
            guildId: 'guild-1',
            channelId: 'channel-1',
            messageId: 'message-1',
        });
    });

    it('skips already recorded daily quote events', async () => {
        mocks.recordIfNew.mockResolvedValue({ created: false });

        await expect(runQuoteOfDayOnce(date)).resolves.toMatchObject({
            processed: 1,
            sent: 0,
            skipped: 1,
            failures: 0,
        });
        expect(mocks.sendChannelMessage).not.toHaveBeenCalled();
    });

    it('schedules retry jobs when delivery returns no message id', async () => {
        mocks.sendChannelMessage.mockResolvedValue(null);
        const queue = new TestJobQueue();

        await registerQuoteOfDayJobs(queue as never, date);
        await runJobHandler(queue, 'quoteofday:run', { date: date.toISOString() });

        expect(queue.scheduled.some((job) => job.name === 'quoteofday:retry')).toBe(true);
        expect(mocks.recordJobRun).toHaveBeenCalledWith('quoteofday', expect.objectContaining({
            ok: false,
            meta: expect.objectContaining({ failures: 1 }),
        }));
    });
});
