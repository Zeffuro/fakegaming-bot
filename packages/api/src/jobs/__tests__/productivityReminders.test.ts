import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import { ReminderConfig, ReminderDelivery, UserTask, UserSession, UserCountdown } from '@zeffuro/fakegaming-common/models';
import { UserTaskManager, UserSessionManager, UserCountdownManager } from '@zeffuro/fakegaming-common/managers';
import { configManager } from '../../vitest.setup.js';
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../utils/discord.js', () => ({ sendDirectMessagePayloadResult: mocks.send }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
import { registerRemindersJobs } from '../reminders.js';
import { prepareProductivityNotification } from '../productivityReminders.js';
import { buildReminderDeliveryPayload } from '../reminderDelivery.js';

const userId = 'productivity-owner';
const messages = { focus: 'Focus', break: 'Break', finished: 'Finished', takeBreak: 'Take break' };
beforeEach(async () => {
    await ReminderDelivery.destroy({ where: {} });
    await ReminderConfig.destroy({ where: {} });
    await UserTask.destroy({ where: {} });
    await UserSession.destroy({ where: {} });
    await UserCountdown.destroy({ where: {} });
    mocks.send.mockReset().mockResolvedValue({ status: 'sent', message: { id: 'message', channel_id: 'channel' } });
});
afterEach(() => vi.restoreAllMocks());

describe('personal reminder delivery integration', () => {
    it('sends a durable task occurrence with message-bound Done/Snooze controls and single-use completion', async () => {
        const tasks = new UserTaskManager();
        const task = await tasks.create({ userId, title: 'Task', dueAt: Date.now() + 60_000, timezone: 'UTC' });
        await ReminderConfig.update({ timestamp: Date.now() - 1_000 }, { where: { id: task.reminderId } });
        const queue = new TestJobQueue();
        await registerRemindersJobs(queue);
        await runJobHandler(queue, 'reminders:run', {});
        const delivery = (await ReminderDelivery.findAll())[0]!;
        const payload = mocks.send.mock.calls[0]![1] as { components: Array<{ components: Array<{ custom_id: string }> }> };
        expect(payload.components[0]?.components.map(item => item.custom_id)).toEqual([`user-task:d:${task.id}:0:${delivery.id}`, `user-task:s:${task.id}:0:${delivery.id}`]);
        expect(delivery).toMatchObject({ status: 'delivered', messageId: 'message', channelId: 'channel', finalized: true });
        const done = await tasks.done(task.id, userId, 0, { id: delivery.id, messageId: 'message', channelId: 'channel' });
        expect(done.state).toBe('completed');
        await expect(tasks.snooze(task.id, userId, 0, Date.now() + 600_000, { id: delivery.id, messageId: 'message', channelId: 'channel' })).rejects.toMatchObject({ code: 'stale' });
        await runJobHandler(queue, 'reminders:run', {});
        expect(mocks.send).toHaveBeenCalledOnce();
    });

    it('a claimed send racing Done leaves completed state, stale controls and no recurring source', async () => {
        const tasks = new UserTaskManager();
        const task = await tasks.create({ userId, title: 'Task', dueAt: Date.now() + 60_000, timezone: 'UTC' });
        await ReminderConfig.update({ timestamp: Date.now() - 1_000 }, { where: { id: task.reminderId } });
        mocks.send.mockImplementationOnce(async () => {
            await tasks.done(task.id, userId, 0);
            return { status: 'sent', message: { id: 'message', channel_id: 'channel' } };
        });
        const queue = new TestJobQueue();
        await registerRemindersJobs(queue);
        await runJobHandler(queue, 'reminders:run', {});
        expect((await tasks.get(task.id, userId))?.state).toBe('completed');
        expect(await ReminderConfig.count()).toBe(0);
        expect((await ReminderDelivery.findAll())[0]?.status).toBe('delivered');
    });

    it.each(['task', 'session', 'countdown'])('does not send when %s cancellation wins between the resource gate and delivery creation', async kind => {
        let cancel: () => Promise<unknown>;
        let sourceId: string;
        if (kind === 'task') {
            const tasks = new UserTaskManager();
            const task = await tasks.create({ userId, title: 'Task', dueAt: Date.now() + 60_000, timezone: 'UTC' });
            sourceId = task.reminderId!;
            cancel = () => tasks.done(task.id, userId, task.version);
        } else if (kind === 'session') {
            const sessions = new UserSessionManager();
            const session = await sessions.start({ userId, title: 'Session', kind: 'focus', minutes: 10, messages });
            sourceId = session.reminderId!;
            cancel = () => sessions.transition(session.id, userId, session.version, 'pause');
        } else {
            const countdowns = new UserCountdownManager();
            const countdown = await countdowns.create({ userId, title: 'Countdown', dueAt: Date.now() + 60_000, timezone: 'UTC', dueMessage: 'Due', advanceMessage: 'Soon' });
            sourceId = `countdown:${countdown.id}:due`;
            cancel = () => countdowns.remove(countdown.id, userId);
        }
        await ReminderConfig.update({ timestamp: Date.now() - 1_000 }, { where: { id: sourceId } });
        const deliveries = configManager.reminderInteractionManager;
        const prepare = deliveries.prepareDelivery.bind(deliveries);
        vi.spyOn(deliveries, 'prepareDelivery').mockImplementationOnce(async (reminder, timestamp) => {
            await cancel();
            return prepare(reminder, timestamp);
        });
        const queue = new TestJobQueue();
        await registerRemindersJobs(queue);
        await runJobHandler(queue, 'reminders:run', {});
        expect(mocks.send).not.toHaveBeenCalled();
        expect(await ReminderConfig.count()).toBe(0);
    });

    it('validates countdown ownership and session state, producing phase messages and no unrelated generic snooze', async () => {
        const now = Date.now();
        const sessions = new UserSessionManager(() => now + 60_000);
        const started = await new UserSessionManager(() => now).start({ userId, title: 'Focus', kind: 'focus', minutes: 1, breakMinutes: 1, cycles: 2, pomodoro: true, messages });
        const source = (await ReminderConfig.findByPk(started.reminderId!))!;
        expect(await sessions.prepareNotification(source.id, userId)).toBe('Break');
        const notification = await prepareProductivityNotification({ id: source.id, userId, message: source.message });
        expect(notification).toMatchObject({ noControls: true });
        expect(buildReminderDeliveryPayload('delivery', 'Break', 'nl', notification!).components).toEqual([]);
        const active = await sessions.getActive(userId);
        await sessions.transition(active!.id, userId, active!.version, 'pause');
        expect(await prepareProductivityNotification({ id: source.id, userId, message: source.message })).toBeNull();
        const countdown = await new UserCountdownManager().create({ userId, title: 'Launch', dueAt: Date.now() + 60_000, timezone: 'UTC', dueMessage: 'Due', advanceMessage: 'Soon' });
        expect(await prepareProductivityNotification({ id: `countdown:${countdown.id}:due`, userId: 'other', message: 'Due' })).toBeNull();
        expect(await prepareProductivityNotification({ id: `countdown:${countdown.id}:due`, userId, message: 'Due' })).toEqual({ content: 'Due', noControls: true });
    });

    it('ignores orphaned personal alerts and keeps maximum task component IDs below Discord limits', async () => {
        expect(await prepareProductivityNotification({ id: 'task:missing:0', userId, message: 'Task' })).toBeNull();
        const id = '00000000-0000-0000-0000-000000000000';
        const payload = buildReminderDeliveryPayload(id, 'Task', 'en', { content: 'Task', task: { id, version: 2_147_483_647 } });
        for (const button of payload.components[0]?.components ?? []) expect(button.custom_id.length).toBeLessThanOrEqual(100);
        expect(configManager.userTaskManager).toBeDefined();
    });
});
