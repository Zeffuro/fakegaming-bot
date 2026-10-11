import { beforeEach, describe, expect, it } from 'vitest';
import { UserTask } from '../../models/personal-productivity.js';
import { UserConfig } from '../../models/user-config.js';
import { ReminderConfig } from '../../models/reminder-config.js';
import { ReminderDelivery } from '../../models/reminder-interaction.js';
import { UserTaskManager } from '../userTaskManager.js';
import { ReminderInteractionManager } from '../reminderInteractionManager.js';
import { taskCompletionSnapshot } from '../taskCompletionUndo.js';

let now = Date.parse('2026-10-24T08:00:00Z');
const input = { userId: 'undo-owner', title: 'Training', checklist: ['Warm up', 'Run'], timezone: 'Europe/Amsterdam' };
const manager = new UserTaskManager(() => now);
beforeEach(async () => {
    now = Date.parse('2026-10-24T08:00:00Z');
    await ReminderDelivery.destroy({ where: {} });
    await ReminderConfig.destroy({ where: {} });
    await UserTask.destroy({ where: {} });
    await UserConfig.upsert({ discordId: input.userId, timezone: input.timezone });
});

describe('undo task completion', () => {
    it('restores exact checklist progress and a fresh reminder after restart, once only', async () => {
        const task = await manager.create({ ...input, dueAt: now + 60_000 });
        const checked = await manager.check(task.id, input.userId, 0, 0);
        const done = await manager.done(task.id, input.userId, 1);
        expect(done).toMatchObject({ state: 'completed', completions: 1, canUndo: true });
        expect(done.checklist.every(item => item.done)).toBe(true);
        expect(await ReminderConfig.count()).toBe(0);
        const restored = await new UserTaskManager(() => now).undo(task.id, input.userId, done.version);
        expect(restored).toMatchObject({ state: 'active', checklist: checked.checklist, dueAt: task.dueAt,
            completedAt: null, completions: 0, version: 3, canUndo: false });
        expect(restored.reminderId).not.toBe(checked.reminderId);
        expect(await ReminderConfig.count()).toBe(1);
        await expect(manager.undo(task.id, input.userId, restored.version)).rejects.toMatchObject({ code: 'stale' });
        expect(await UserTask.findByPk(task.id)).toMatchObject({ undoCompletionJson: null });
    });

    it('undoes the latest recurring occurrence through DST and cancels the next reminder', async () => {
        const task = await manager.create({ ...input, dueAt: now + 60_000, recurrence: { unit: 'day', interval: 1, timezone: input.timezone } });
        const first = await manager.done(task.id, input.userId, 0);
        const checked = await manager.check(task.id, input.userId, first.version, 0);
        now += 86_400_000;
        const second = await manager.done(task.id, input.userId, checked.version);
        const undone = await manager.undo(task.id, input.userId, second.version);
        expect(undone).toMatchObject({ state: 'active', dueAt: checked.dueAt, checklist: checked.checklist,
            completedAt: first.completedAt, completions: 1, recurrence: task.recurrence, canUndo: false });
        expect(await ReminderConfig.findByPk(second.reminderId!)).toBeNull();
        expect(await ReminderConfig.count()).toBe(0);
    });

    it('preserves an overdue deadline without replaying its delivered controls', async () => {
        const task = await manager.create({ ...input, dueAt: now + 60_000 });
        const deliveries = new ReminderInteractionManager(() => now);
        const delivery = await deliveries.prepareDelivery({ id: task.reminderId!, userId: input.userId, message: task.title }, task.dueAt!);
        await deliveries.claimDelivery(delivery.id);
        await deliveries.markDelivered(delivery.id, 'message', 'channel');
        now += 120_000;
        const scope = { id: delivery.id, messageId: 'message', channelId: 'channel' };
        const done = await manager.done(task.id, input.userId, 0, scope);
        const undone = await manager.undo(task.id, input.userId, done.version);
        expect(undone).toMatchObject({ dueAt: task.dueAt, reminderId: null, state: 'active' });
        expect(await ReminderConfig.count()).toBe(0);
        await expect(manager.done(task.id, input.userId, undone.version, scope)).rejects.toMatchObject({ code: 'stale' });
        expect((await manager.get(task.id, input.userId))?.completions).toBe(0);
    });

    it.each(['check', 'edit', 'snooze'] as const)('invalidates undo after a later %s without overwriting new progress', async action => {
        const task = await manager.create({ ...input, recurrence: { unit: 'day', interval: 1, timezone: input.timezone } });
        const done = await manager.done(task.id, input.userId, 0);
        const changed = action === 'check' ? await manager.check(task.id, input.userId, done.version, 0)
            : action === 'edit' ? await manager.edit(task.id, input.userId, done.version, { title: 'Changed', checklist: [], timezone: input.timezone })
                : await manager.snooze(task.id, input.userId, done.version, now + 600_000);
        expect(changed.canUndo).toBe(false);
        await expect(manager.undo(task.id, input.userId, changed.version)).rejects.toMatchObject({ code: 'stale' });
        expect(await manager.get(task.id, input.userId)).toEqual(changed);
    });

    it('rejects foreign owners, stale versions and competing requests', async () => {
        const task = await manager.create(input);
        await expect(manager.undo(task.id, input.userId, 0)).rejects.toMatchObject({ code: 'stale' });
        const done = await manager.done(task.id, input.userId, 0);
        await expect(manager.undo(task.id, 'other', done.version)).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.undo(task.id, input.userId, 0)).rejects.toMatchObject({ code: 'stale' });
        const results = await Promise.allSettled([manager.undo(task.id, input.userId, done.version), manager.undo(task.id, input.userId, done.version)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'stale' } });
    });

    it('keeps completion intact at capacity and allows undo after capacity becomes available', async () => {
        const task = await manager.create(input);
        const done = await manager.done(task.id, input.userId, 0);
        await UserTask.bulkCreate(Array.from({ length: 100 }, (_, index) => ({ id: `capacity-${index}`, userId: input.userId,
            title: 'Other', checklistJson: '[]', state: 'active', timezone: input.timezone, version: 0, completions: 0 })));
        await expect(manager.undo(task.id, input.userId, done.version)).rejects.toMatchObject({ code: 'capacity' });
        expect(await manager.get(task.id, input.userId)).toEqual(done);
        await manager.remove('capacity-0', input.userId);
        expect((await manager.undo(task.id, input.userId, done.version)).state).toBe('active');
        expect(await UserTask.count({ where: { userId: input.userId, state: 'active' } })).toBe(100);
    });

    it('does not offer undo for legacy or malformed persisted snapshots', async () => {
        const task = await manager.create(input);
        const done = await manager.done(task.id, input.userId, 0);
        for (const value of [null, '{', 'null', '{}', JSON.stringify({ version: done.version, dueAt: -1, checklist: [], completedAt: null, completions: 0 })]) {
            await UserTask.update({ undoCompletionJson: value }, { where: { id: task.id } });
            expect((await manager.get(task.id, input.userId))?.canUndo).toBe(false);
            await expect(manager.undo(task.id, input.userId, done.version)).rejects.toMatchObject({ code: 'stale' });
        }
        expect(taskCompletionSnapshot(undefined, 0)).toBeNull();
        for (const invalid of [{ completions: -1 }, { completedAt: 'bad' }, { checklist: Array(11).fill({ text: 'Item', done: true }) },
            { checklist: [{ text: '', done: true }] }, { checklist: [{ text: 'Item', done: 1 }] }]) {
            expect(taskCompletionSnapshot(JSON.stringify({ version: 1, dueAt: null, completedAt: null, completions: 0, checklist: [], ...invalid }), 1)).toBeNull();
        }
    });
});
