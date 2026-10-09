import { beforeEach, describe, expect, it } from 'vitest';
import { UserTask } from '../../models/personal-productivity.js';
import { ReminderConfig } from '../../models/reminder-config.js';
import { ReminderDelivery } from '../../models/reminder-interaction.js';
import { UserTaskManager } from '../userTaskManager.js';
import { ReminderInteractionManager } from '../reminderInteractionManager.js';

let now = Date.parse('2026-10-23T08:00:00Z');
const input = { userId: 'owner', title: 'Training', checklist: ['Warm up', 'Run'], timezone: 'Europe/Amsterdam' };
beforeEach(async () => {
    now = Date.parse('2026-10-23T08:00:00Z');
    await ReminderDelivery.destroy({ where: {} });
    await ReminderConfig.destroy({ where: {} });
    await UserTask.destroy({ where: {} });
});

describe('private tasks', () => {
    it('restores checklist and due reminder after manager restart, and scopes every mutation to its owner', async () => {
        const manager = new UserTaskManager(() => now);
        const task = await manager.create({ ...input, dueAt: now + 60_000 });
        const checked = await manager.check(task.id, 'owner', task.version, 0);
        expect((await new UserTaskManager(() => now).get(task.id, 'owner'))?.checklist[0]?.done).toBe(true);
        expect(await manager.get(task.id, 'other')).toBeNull();
        expect(await manager.remove(task.id, 'other')).toBe(false);
        await expect(manager.done(task.id, 'other', checked.version)).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.snooze(task.id, 'other', checked.version, now + 120_000)).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.check(task.id, 'other', checked.version, 1)).rejects.toMatchObject({ code: 'missing' });
        expect(await ReminderConfig.count()).toBe(1);
        expect(await ReminderConfig.findByPk(task.reminderId!)).toBeNull();
        expect(checked.reminderId).not.toBe(task.reminderId);
        expect(await manager.forReminder(checked.reminderId!, 'other')).toBeNull();
        await manager.remove(task.id, 'owner');
        expect(await ReminderConfig.count()).toBe(0);
    });

    it('only Done advances recurrence, exactly once, from completion wall time through DST', async () => {
        const manager = new UserTaskManager(() => now);
        const task = await manager.create({ ...input, dueAt: now + 60_000, recurrence: { unit: 'day', interval: 1, timezone: input.timezone } });
        const snoozed = await manager.snooze(task.id, 'owner', 0, now + 600_000);
        expect(snoozed).toMatchObject({ completions: 0, completedAt: null, dueAt: now + 600_000 });
        now = Date.parse('2026-10-24T08:00:00Z');
        const results = await Promise.allSettled([manager.done(task.id, 'owner', snoozed.version), new UserTaskManager(() => now).done(task.id, 'owner', snoozed.version)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'stale' } });
        const next = await manager.get(task.id, 'owner');
        expect(next).toMatchObject({ state: 'active', completions: 1, dueAt: Date.parse('2026-10-25T08:00:00Z'), completedAt: now });
        expect(next?.checklist.every(item => !item.done)).toBe(true);
        expect(await ReminderConfig.count()).toBe(1);
    });

    it('consumes notification controls atomically and rejects copied bindings, replay and competing transitions', async () => {
        const manager = new UserTaskManager(() => now);
        const task = await manager.create({ ...input, dueAt: now + 60_000 });
        const deliveries = new ReminderInteractionManager(() => now);
        const delivery = await deliveries.prepareDelivery({ id: task.reminderId!, userId: 'owner', message: task.title }, task.dueAt!);
        await deliveries.claimDelivery(delivery.id);
        await deliveries.markDelivered(delivery.id, 'message', 'channel');
        const scope = { id: delivery.id, messageId: 'message', channelId: 'channel' };
        await expect(manager.done(task.id, 'owner', 0, { ...scope, messageId: 'forged' })).rejects.toMatchObject({ code: 'stale' });
        expect((await manager.get(task.id, 'owner'))?.state).toBe('active');
        await manager.snooze(task.id, 'owner', 0, now + 600_000, scope);
        expect((await ReminderDelivery.findByPk(delivery.id))?.status).toBe('snoozed');
        await expect(manager.done(task.id, 'owner', 0, scope)).rejects.toMatchObject({ code: 'stale' });
        expect(await ReminderConfig.count()).toBe(1);
    });

    it('cancels a prepared delivery before claim and never resurrects a completed task from an in-flight send', async () => {
        const manager = new UserTaskManager(() => now);
        const deliveries = new ReminderInteractionManager(() => now);
        const task = await manager.create({ ...input, dueAt: now + 60_000 });
        const pending = await deliveries.prepareDelivery({ id: task.reminderId!, userId: 'owner', message: task.title }, task.dueAt!);
        await manager.done(task.id, 'owner', 0);
        expect(await deliveries.claimDelivery(pending.id)).toBe(false);
        const other = await manager.create({ ...input, dueAt: now + 60_000 });
        const sending = await deliveries.prepareDelivery({ id: other.reminderId!, userId: 'owner', message: other.title }, other.dueAt!);
        await deliveries.claimDelivery(sending.id);
        await manager.done(other.id, 'owner', 0);
        await deliveries.markDelivered(sending.id, 'message', 'channel');
        await deliveries.finalizeDelivery(sending.id, null, now);
        await expect(manager.done(other.id, 'owner', 0, { id: sending.id, messageId: 'message', channelId: 'channel' })).rejects.toMatchObject({ code: 'stale' });
        expect((await manager.get(other.id, 'owner'))?.completions).toBe(1);
        expect(await ReminderConfig.count()).toBe(0);
    });

    it('rolls back invalid changes, preserves checklist completion and retains finished tasks for 90 days per owner', async () => {
        const manager = new UserTaskManager(() => now);
        await expect(manager.create({ ...input, title: ' ', dueAt: now - 1 })).rejects.toMatchObject({ code: 'invalid' });
        await expect(manager.create({ ...input, checklist: Array(11).fill('item') })).rejects.toMatchObject({ code: 'invalid' });
        const task = await manager.create(input);
        await expect(manager.check(task.id, 'owner', 0, 50)).rejects.toMatchObject({ code: 'invalid' });
        const done = await manager.done(task.id, 'owner', 0);
        expect(done.checklist.every(item => item.done)).toBe(true);
        now += 8 * 86_400_000;
        expect(await manager.list('owner', true)).toHaveLength(1);
        now += 83 * 86_400_000;
        expect(await manager.list('owner', true)).toHaveLength(0);
    });
});
