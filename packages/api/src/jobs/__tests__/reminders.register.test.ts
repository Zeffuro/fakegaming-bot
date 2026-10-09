import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

const mocks = vi.hoisted(() => ({
    send: vi.fn(), getAll: vi.fn(), update: vi.fn(), reschedule: vi.fn(), remove: vi.fn(),
    prepare: vi.fn(), mark: vi.fn(), prune: vi.fn(), claim: vi.fn(), release: vi.fn(), uncertain: vi.fn(), finalize: vi.fn(),
}));
vi.mock('../../utils/discord.js', () => ({ sendDirectMessagePayloadResult: mocks.send }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({
    reminderManager: {
        getAllPlain: mocks.getAll, updatePlain: mocks.update,
        rescheduleRecurringReminder: mocks.reschedule, removeReminder: mocks.remove,
    },
    reminderInteractionManager: {
        prepareDelivery: mocks.prepare, markDelivered: mocks.mark, prune: mocks.prune,
        claimDelivery: mocks.claim, releaseDelivery: mocks.release, markUncertain: mocks.uncertain,
        finalizeDelivery: mocks.finalize,
    },
}) }));

import { registerRemindersJobs } from '../reminders.js';
import { buildReminderDeliveryPayload } from '../reminderDelivery.js';

const now = Date.parse('2026-10-07T10:00Z');
const reminder = { id: 'reminder', userId: 'owner', message: 'task @everyone', timespan: '1h', timestamp: now - 1_000 };

async function run(): Promise<void> {
    const queue = new TestJobQueue();
    await registerRemindersJobs(queue, new Date(now));
    const { done } = await runJobHandler(queue, 'reminders:run', {});
    expect(done).toHaveBeenCalled();
}

describe('reminder delivery jobs', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(now);
        mocks.getAll.mockResolvedValue([reminder]);
        mocks.prepare.mockResolvedValue({ id: 'delivery', status: 'pending', scheduledAt: reminder.timestamp, attemptedAt: null });
        mocks.claim.mockResolvedValue(true);
        mocks.send.mockResolvedValue({ status: 'sent', message: { id: 'dm-message', channel_id: 'dm-channel' } });
        mocks.prune.mockResolvedValue(undefined);
    });
    afterEach(() => vi.useRealTimers());

    it('records delivery before removing a one-off and sends buttons without mentions', async () => {
        await run();
        expect(mocks.mark).toHaveBeenCalledWith('delivery', 'dm-message', 'dm-channel');
        expect(mocks.mark.mock.invocationCallOrder[0]).toBeLessThan(mocks.finalize.mock.invocationCallOrder[0]!);
        expect(mocks.finalize).toHaveBeenCalledWith('delivery', null, now);
        const payload = mocks.send.mock.calls[0]![1];
        expect(payload.allowed_mentions).toEqual({ parse: [] });
        expect(payload.content).toContain('task @everyone');
        expect(payload.components[0].components.map((button: { custom_id: string }) => button.custom_id)).toEqual([
            'reminder:snooze:delivery:600', 'reminder:snooze:delivery:3600', 'reminder:custom-snooze:delivery', 'reminder:dismiss:delivery',
        ]);
    });

    it('reschedules recurring reminders and skips paused reminders', async () => {
        mocks.getAll.mockResolvedValue([
            { ...reminder, recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceTimezone: 'UTC' },
            { ...reminder, id: 'paused', completed: true },
        ]);
        await run();
        expect(mocks.send).toHaveBeenCalledTimes(1);
        expect(mocks.finalize).toHaveBeenCalledWith('delivery', reminder.timestamp + 7 * 86_400_000, now);
    });

    it('keeps failed deliveries pending and applies existing retry backoff', async () => {
        mocks.send.mockResolvedValue({ status: 'rejected' });
        await run();
        expect(mocks.mark).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
        expect(mocks.finalize).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.release).toHaveBeenCalledWith('delivery', now + 60_000);
    });

    it('does not resend after recorded delivery database finalization fails', async () => {
        mocks.finalize.mockRejectedValueOnce(new Error('database temporarily unavailable'));
        await run();
        expect(mocks.update).not.toHaveBeenCalled();
        mocks.prepare.mockResolvedValue({ id: 'delivery', status: 'delivered', scheduledAt: reminder.timestamp });
        await run();
        expect(mocks.send).toHaveBeenCalledTimes(1);
        expect(mocks.finalize).toHaveBeenCalledTimes(2);
    });

    it.each(['snoozed', 'dismissed'])('finalizes previously %s deliveries without another message', async status => {
        mocks.prepare.mockResolvedValue({ id: 'delivery', status, scheduledAt: reminder.timestamp });
        await run();
        expect(mocks.send).not.toHaveBeenCalled();
        expect(mocks.finalize).toHaveBeenCalledWith('delivery', null, now);
    });

    it('does not delete the source if delivery preparation fails', async () => {
        mocks.prepare.mockRejectedValue(new Error('database unavailable'));
        await run();
        expect(mocks.send).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
        expect(mocks.finalize).not.toHaveBeenCalled();
        expect(mocks.update).toHaveBeenCalled();
    });

    it('does not POST when another worker owns the send claim', async () => {
        mocks.claim.mockResolvedValue(false);
        await run();
        expect(mocks.send).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
        expect(mocks.finalize).not.toHaveBeenCalled();
    });

    it('retains a claim if delivery activation fails and never repeats the uncertain POST', async () => {
        mocks.mark.mockRejectedValueOnce(new Error('write failed after Discord accepted'));
        await run();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
        mocks.prepare.mockResolvedValue({ id: 'delivery', status: 'sending', attemptedAt: now, scheduledAt: reminder.timestamp });
        await run();
        expect(mocks.send).toHaveBeenCalledTimes(1);
        expect(mocks.remove).not.toHaveBeenCalled();
        vi.setSystemTime(now + 6 * 60_000);
        await run();
        expect(mocks.uncertain).toHaveBeenCalledWith('delivery');
        expect(mocks.send).toHaveBeenCalledTimes(1);
        expect(mocks.finalize).toHaveBeenCalledWith('delivery', null, now + 6 * 60_000);
    });

    it('does not replay unknown transport outcomes or malformed success responses', async () => {
        mocks.send.mockResolvedValueOnce({ status: 'unknown' });
        await run();
        expect(mocks.uncertain).toHaveBeenCalledWith('delivery');
        expect(mocks.release).not.toHaveBeenCalled();
        expect(mocks.finalize).toHaveBeenCalled();
        mocks.send.mockResolvedValueOnce({ status: 'sent', message: {} });
        await run();
        expect(mocks.uncertain).toHaveBeenCalledTimes(2);
    });

    it('schedules another pass even when pruning or reading reminders fails', async () => {
        mocks.prune.mockRejectedValueOnce(new Error('database unavailable'));
        const queue = new TestJobQueue();
        const schedule = vi.spyOn(queue, 'schedule');
        await registerRemindersJobs(queue, new Date(now));
        schedule.mockClear();
        const { done } = await runJobHandler(queue, 'reminders:run', {});
        expect(done).toHaveBeenCalled();
        expect(schedule).toHaveBeenCalled();
        expect(mocks.send).not.toHaveBeenCalled();
    });

    it('localizes controls and limits long messages', () => {
        const en = buildReminderDeliveryPayload('id', 'message', 'en');
        const nl = buildReminderDeliveryPayload('id', 'x'.repeat(3000), 'nl');
        expect(en.components[0]!.components[0]!.label).toBe('Snooze 10m');
        expect(nl.components[0]!.components[1]!.label).toBe('Snooze 1u');
        expect(nl.content).toHaveLength(2000);
        expect(nl.components[0]!.components[0]!.custom_id).toBe(en.components[0]!.components[0]!.custom_id);
    });
});

