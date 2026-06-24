import { describe, it, expect, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

const sentDMs: any[] = [];
vi.mock('../../utils/discord.js', () => ({ sendDirectMessage: vi.fn(async (_user: string, _msg: string) => sentDMs.shift() ?? null) }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

const updatePlain = vi.fn();
const rescheduleRecurringReminder = vi.fn();
const removeReminder = vi.fn().mockResolvedValue(undefined);
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({
    reminderManager: {
        getAllPlain: vi.fn().mockResolvedValue([
            { id: '1', userId: 'u1', message: 'm1', timespan: '5m', timestamp: Date.now() - 1000 },
            { id: '2', userId: 'u2', message: 'm2', timespan: null, timestamp: Date.now() - 1000 },
            { id: '3', userId: 'u3', message: 'm3', timespan: '1h', timestamp: Date.now() - 1000, recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceTimezone: 'UTC' },
            { id: '4', userId: 'u4', message: 'm4', timespan: '1h', timestamp: Date.now() - 1000, completed: true, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceTimezone: 'UTC' },
        ]),
        updatePlain,
        rescheduleRecurringReminder,
        removeReminder,
    }
}) }));

import { registerRemindersJobs } from '../reminders.js';

describe('registerRemindersJobs', () => {
    it('processes due reminders and schedules next', async () => {
        const q = new TestJobQueue();
        // First DM succeeds, second fails, third succeeds and recurs.
        sentDMs.push({ id: 'ok' }); sentDMs.push(null); sentDMs.push({ id: 'recurring' });
        await registerRemindersJobs(q as any, new Date('2025-01-01T00:00:00Z'));
        const { done } = await runJobHandler(q, 'reminders:run', {});
        expect(done).toHaveBeenCalled();
        expect(updatePlain).toHaveBeenCalledTimes(1); // backoff applied for failed send
        expect(removeReminder).not.toHaveBeenCalledWith('4');
        expect(rescheduleRecurringReminder).toHaveBeenCalledWith('3', expect.any(Number), expect.any(Number));
        expect(sentDMs).toEqual([]);
    });
});

