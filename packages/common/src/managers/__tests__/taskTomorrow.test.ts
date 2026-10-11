import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserTask } from '../../models/personal-productivity.js';
import { UserConfig } from '../../models/user-config.js';
import { ReminderConfig } from '../../models/reminder-config.js';
import { ReminderDelivery } from '../../models/reminder-interaction.js';
import { UserTaskManager } from '../userTaskManager.js';
import { ReminderInteractionManager } from '../reminderInteractionManager.js';
import { taskTomorrowTimestamp } from '../../utils/reminderTime.js';

const userId = 'tomorrow-owner';
let now = Date.parse('2026-10-24T18:00Z');
const manager = new UserTaskManager(() => now);
const input = { userId, title: 'Shopping', checklist: ['Milk', 'Bread'], timezone: 'Europe/Amsterdam' };
beforeEach(async () => {
    now = Date.parse('2026-10-24T18:00Z');
    await ReminderDelivery.destroy({ where: {} }); await ReminderConfig.destroy({ where: {} });
    await UserTask.destroy({ where: {} });
    await UserConfig.upsert({ discordId: userId, timezone: input.timezone });
});

describe('do this tomorrow', () => {
    it.each([
        ['2026-10-24T18:00Z', '2026-10-24T20:15Z', '2026-10-25T21:15Z'],
        ['2026-03-28T18:00Z', '2026-03-28T21:15Z', '2026-03-29T20:15Z'],
        ['2026-03-28T18:00Z', '2026-03-28T01:30Z', '2026-03-29T01:00Z'],
        ['2026-10-24T18:00Z', '2026-10-24T00:30Z', '2026-10-25T00:30Z'],
        ['2026-12-31T23:30Z', null, '2027-01-02T08:00Z'],
    ])('uses the next saved-zone date through DST/year boundaries (%s)', (at, due, expected) => {
        expect(taskTomorrowTimestamp(input.timezone, Date.parse(at), due === null ? null : Date.parse(due))).toBe(Date.parse(expected));
    });
    it('uses 09:00 for undated tasks and rejects invalid clocks/zones', () => {
        expect(taskTomorrowTimestamp(input.timezone, now, null)).toBe(Date.parse('2026-10-25T08:00Z'));
        expect(taskTomorrowTimestamp('Invalid/Zone', now, null)).toBeNull();
        expect(taskTomorrowTimestamp('UTC', NaN, null)).toBeNull();
        expect(taskTomorrowTimestamp('UTC', now, Infinity)).toBeNull();
    });
    it('preserves progress, source and recurrence while replacing reminders and invalidating undo', async () => {
        const original = await manager.create({ ...input, dueAt: now + 60_000, recurrence: { unit: 'day', interval: 1, timezone: input.timezone } });
        const done = await manager.done(original.id, userId, 0);
        const checked = await manager.check(original.id, userId, done.version, 0);
        const moved = await manager.tomorrow(original.id, userId, checked.version);
        expect(moved).toMatchObject({ state: 'active', checklist: checked.checklist, recurrence: original.recurrence,
            completedAt: done.completedAt, completions: 1, canUndo: false, version: checked.version + 1 });
        expect(await ReminderConfig.findByPk(checked.reminderId!)).toBeNull();
        expect(await ReminderConfig.count()).toBe(1);
        expect(moved.dueAt).toBe(Date.parse('2026-10-25T18:00Z'));
    });
    it('consumes delivered controls and rolls back mismatched delivery scope', async () => {
        const task = await manager.create({ ...input, dueAt: now + 60_000 });
        const deliveries = new ReminderInteractionManager(() => now);
        const delivery = await deliveries.prepareDelivery({ id: task.reminderId!, userId, message: task.title }, task.dueAt!);
        await deliveries.claimDelivery(delivery.id); await deliveries.markDelivered(delivery.id, 'message', 'channel');
        const scope = { id: delivery.id, messageId: 'message', channelId: 'channel' };
        await expect(manager.tomorrow(task.id, userId, 0, { ...scope, channelId: 'wrong' })).rejects.toMatchObject({ code: 'stale' });
        expect(await manager.get(task.id, userId)).toEqual(task);
        const moved = await manager.tomorrow(task.id, userId, 0, scope);
        expect(await ReminderDelivery.findByPk(delivery.id)).toMatchObject({ status: 'snoozed' });
        await expect(manager.tomorrow(task.id, userId, moved.version, scope)).rejects.toMatchObject({ code: 'stale' });
    });
    it('uses current saved preferences, protects owner/state/version and competing requests', async () => {
        const task = await manager.create(input);
        await UserConfig.update({ timezone: 'Pacific/Auckland' }, { where: { discordId: userId } });
        await expect(manager.tomorrow(task.id, 'other', 0)).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.tomorrow(task.id, userId, 1)).rejects.toMatchObject({ code: 'stale' });
        const results = await Promise.allSettled([manager.tomorrow(task.id, userId, 0), manager.tomorrow(task.id, userId, 0)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect((await manager.get(task.id, userId))?.dueAt).toBe(Date.parse('2026-10-25T20:00Z'));
        const completed = await manager.done(task.id, userId, 1);
        await expect(manager.tomorrow(task.id, userId, completed.version)).rejects.toMatchObject({ code: 'stale' });
    });
    it('rolls back reminder replacement if scheduling fails', async () => {
        const task = await manager.create({ ...input, dueAt: now + 60_000 });
        const fail = vi.spyOn(ReminderConfig, 'create').mockRejectedValueOnce(new Error('storage failure'));
        try { await expect(manager.tomorrow(task.id, userId, 0)).rejects.toThrow('storage failure'); }
        finally { fail.mockRestore(); }
        expect(await manager.get(task.id, userId)).toEqual(task);
        expect(await ReminderConfig.findByPk(task.reminderId!)).not.toBeNull();
    });
});
