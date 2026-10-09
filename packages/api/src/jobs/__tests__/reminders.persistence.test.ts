import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReminderDelivery } from '@zeffuro/fakegaming-common/models';
import { ReminderInteractionManager } from '@zeffuro/fakegaming-common/managers';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../../vitest.setup.js';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../utils/discord.js', () => ({ sendDirectMessagePayloadResult: mocks.send }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

import { registerRemindersJobs } from '../reminders.js';

const userId = 'reminder-persistence-owner';
const messageId = 'persisted-dm-message';
const channelId = 'persisted-dm-channel';
const message = 'Follow up on this message: https://discord.com/channels/guild/channel/source';

async function sourceReminder() {
    return configManager.reminderManager.createForUser({
        id: randomUUID(), userId, message, timespan: '1h', timestamp: Date.now() - 1_000,
    });
}

async function queue(): Promise<TestJobQueue> {
    const result = new TestJobQueue();
    await registerRemindersJobs(result);
    return result;
}

describe('persisted reminder job lifecycle', () => {
    beforeEach(async () => {
        await configManager.reminderManager.removeAll();
        await ReminderDelivery.destroy({ where: {} });
        mocks.send.mockResolvedValue({ status: 'sent', message: { id: messageId, channel_id: channelId } });
    });

    afterEach(async () => {
        await ReminderDelivery.destroy({ where: { userId } });
        for (const reminder of await configManager.reminderManager.listForUser(userId)) {
            await configManager.reminderManager.removeForUser(reminder.id, userId);
        }
    });

    it('delivers a real source reminder and atomically creates one independent snoozed reminder', async () => {
        const source = await sourceReminder();
        const jobs = await queue();
        const { done } = await runJobHandler(jobs, 'reminders:run', {});
        expect(done).toHaveBeenCalledOnce();
        expect(mocks.send).toHaveBeenCalledOnce();
        expect(mocks.send).toHaveBeenCalledWith(userId, expect.objectContaining({
            content: expect.stringContaining(message), allowed_mentions: { parse: [] },
        }));

        const records = await ReminderDelivery.findAll({ where: { reminderId: source.id } });
        expect(records).toHaveLength(1);
        const delivery = records[0]!;
        expect(delivery).toMatchObject({
            userId, message, messageId, channelId, status: 'delivered', finalized: true,
        });
        expect(Number(delivery.scheduledAt)).toBe(Number(source.timestamp));
        expect(await configManager.reminderManager.getForUser(source.id, userId)).toBeNull();
        const buttons = mocks.send.mock.calls[0]![1].components[0].components;
        expect(buttons[0].custom_id).toBe(`reminder:snooze:${delivery.id}:600`);

        const reloaded = new ReminderInteractionManager();
        expect(await reloaded.getDelivery(delivery.id, userId)).toMatchObject({ messageId, channelId });
        const timestamp = Date.now() + 600_000;
        const results = await Promise.all([
            reloaded.snoozeDelivery(delivery.id, userId, timestamp, '10m', messageId, channelId),
            reloaded.snoozeDelivery(delivery.id, userId, timestamp, '10m', messageId, channelId),
        ]);
        expect(results.filter(Boolean)).toHaveLength(1);
        const reminders = await configManager.reminderManager.listForUser(userId);
        expect(reminders).toHaveLength(1);
        expect(reminders[0]).toMatchObject({
            userId, message, timespan: '10m',
            recurrenceUnit: null, recurrenceInterval: null, recurrenceTimezone: null,
        });
        expect(Boolean(reminders[0]!.completed)).toBe(false);
        expect(reminders[0]!.id).not.toBe(source.id);
        expect(Number(reminders[0]!.timestamp)).toBe(timestamp);
        expect(await ReminderDelivery.findByPk(delivery.id)).toMatchObject({ status: 'snoozed', finalized: true });

        await runJobHandler(jobs, 'reminders:run', {});
        expect(mocks.send).toHaveBeenCalledOnce();
    });

    it('keeps concurrent handlers from sending a claimed occurrence twice', async () => {
        const source = await sourceReminder();
        const firstQueue = await queue();
        const secondQueue = await queue();
        let acknowledgeSend!: () => void;
        let completeSend!: () => void;
        const sending = new Promise<void>(resolve => { acknowledgeSend = resolve; });
        const response = new Promise<void>(resolve => { completeSend = resolve; });
        mocks.send.mockImplementation(async () => {
            acknowledgeSend();
            await response;
            return { status: 'sent', message: { id: messageId, channel_id: channelId } };
        });

        const first = runJobHandler(firstQueue, 'reminders:run', {});
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([
                sending,
                new Promise<never>((_resolve, reject) => {
                    timeout = setTimeout(() => reject(new Error('Reminder job did not reach Discord transport')), 2_000);
                }),
            ]);
            expect(await ReminderDelivery.findOne({ where: { reminderId: source.id } })).toMatchObject({ status: 'sending' });
            const second = await runJobHandler(secondQueue, 'reminders:run', {});
            expect(second.done).toHaveBeenCalledOnce();
            expect(mocks.send).toHaveBeenCalledOnce();
            expect(await configManager.reminderManager.getForUser(source.id, userId)).not.toBeNull();
        } finally {
            clearTimeout(timeout);
            completeSend();
            await first;
        }

        const deliveries = await ReminderDelivery.findAll({ where: { reminderId: source.id } });
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0]).toMatchObject({ status: 'delivered', finalized: true, messageId, channelId });
        expect(await configManager.reminderManager.getForUser(source.id, userId)).toBeNull();
        await runJobHandler(secondQueue, 'reminders:run', {});
        expect(mocks.send).toHaveBeenCalledOnce();
    });

    it.each(['delete', 'pause', 'snooze'])('honors %s after the due reminder snapshot', async action => {
        const manager = configManager.reminderManager;
        const source = await sourceReminder();
        if (action === 'pause') await manager.updatePlain({ recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceTimezone: 'UTC' } as never, { id: source.id } as never);
        const nextTimestamp = Date.now() + 3_600_000;
        const getAll = manager.getAllPlain.bind(manager);
        vi.spyOn(manager, 'getAllPlain').mockImplementationOnce(async () => {
            const snapshot = await getAll();
            if (action === 'delete') await manager.removeForUser(source.id, userId);
            if (action === 'pause') await manager.setPausedForUser(source.id, userId, { paused: true });
            if (action === 'snooze') await manager.snoozeForUser(source.id, userId, { timespan: '1h', timestamp: nextTimestamp });
            return snapshot;
        });
        await runJobHandler(await queue(), 'reminders:run', {});
        expect(mocks.send).not.toHaveBeenCalled();
        const persisted = await manager.getForUser(source.id, userId);
        if (action === 'delete') expect(persisted).toBeNull();
        if (action === 'pause') expect(Boolean(persisted?.completed)).toBe(true);
        if (action === 'snooze') expect(Number(persisted?.timestamp)).toBe(nextTimestamp);
    });

    it.each(['sent', 'rejected'])('keeps an in-flight snooze when Discord reports %s', async status => {
        const source = await sourceReminder();
        const nextTimestamp = Date.now() + 3_600_000;
        mocks.send.mockImplementationOnce(async () => {
            await configManager.reminderManager.snoozeForUser(source.id, userId, { timespan: '1h', timestamp: nextTimestamp });
            return status === 'sent' ? { status, message: { id: messageId, channel_id: channelId } } : { status };
        });
        await runJobHandler(await queue(), 'reminders:run', {});
        expect(Number((await configManager.reminderManager.getForUser(source.id, userId))?.timestamp)).toBe(nextTimestamp);
        expect(await ReminderDelivery.findOne({ where: { reminderId: source.id } })).toMatchObject({ finalized: true });
    });
});
