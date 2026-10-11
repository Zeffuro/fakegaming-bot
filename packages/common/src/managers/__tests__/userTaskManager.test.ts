import { beforeEach, describe, expect, it } from 'vitest';
import { UserTask } from '../../models/personal-productivity.js';
import { ReminderConfig } from '../../models/reminder-config.js';
import { ReminderDelivery } from '../../models/reminder-interaction.js';
import { UserTaskManager } from '../userTaskManager.js';
import { ReminderInteractionManager } from '../reminderInteractionManager.js';
import { UserConfig } from '../../models/user-config.js';
import { serializedTransaction } from '../serializedTransaction.js';

let now = Date.parse('2026-10-23T08:00:00Z');
const input = { userId: 'owner', title: 'Training', checklist: ['Warm up', 'Run'], timezone: 'Europe/Amsterdam' };
beforeEach(async () => {
    now = Date.parse('2026-10-23T08:00:00Z');
    await ReminderDelivery.destroy({ where: {} });
    await ReminderConfig.destroy({ where: {} });
    await UserTask.destroy({ where: {} });
    await UserConfig.upsert({ discordId: 'owner', timezone: input.timezone });
});

describe('private tasks', () => {
    it('rechecks saved timezone after a queued settings change and rolls back external task creation', async () => {
        const manager = new UserTaskManager(() => now);
        const task = await manager.create(input);
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const settingsChange = serializedTransaction(UserTask.sequelize!, async transaction => {
            await gate;
            await UserConfig.update({ timezone: 'UTC' }, { where: { discordId: 'owner' }, transaction });
        });
        const edit = manager.edit(task.id, 'owner', 0, { title: 'Changed', checklist: [], timezone: input.timezone });
        release(); await settingsChange;
        await expect(edit).rejects.toMatchObject({ code: 'invalid' });
        expect(await manager.get(task.id, 'owner')).toMatchObject({ title: input.title, version: 0 });
        await expect(serializedTransaction(UserTask.sequelize!, async transaction => {
            await manager.create({ ...input, dueAt: now + 60_000 }, transaction);
            throw new Error('Rollback caller');
        })).rejects.toThrow('Rollback caller');
        expect(await UserTask.count()).toBe(1); expect(await ReminderConfig.count()).toBe(0);
    });
    it('edits an overdue task atomically, replaces its delivery and preserves recurrence and source binding', async () => {
        const manager = new UserTaskManager(() => now);
        const deliveries = new ReminderInteractionManager(() => now);
        const task = await manager.create({ ...input, dueAt: now + 60_000, recurrence: { unit: 'day', interval: 1, timezone: input.timezone } });
        await UserTask.update({ sourceNoteId: 'source-note', sourceUrl: 'https://example.com/note' }, { where: { id: task.id } });
        const delivery = await deliveries.prepareDelivery({ id: task.reminderId!, userId: 'owner', message: task.title }, task.dueAt!);
        await deliveries.claimDelivery(delivery.id);
        now += 120_000;
        const changed = await manager.edit(task.id, 'owner', 0, { title: 'Changed', checklist: [{ text: 'Keep checked', done: true }], timezone: input.timezone });
        expect(changed).toMatchObject({ title: 'Changed', version: 1, dueAt: task.dueAt, sourceNoteId: 'source-note',
            sourceUrl: 'https://example.com/note', recurrence: task.recurrence, checklist: [{ text: 'Keep checked', done: true }] });
        expect(await ReminderConfig.findByPk(task.reminderId!)).toBeNull();
        expect((await ReminderConfig.findByPk(changed.reminderId!))?.timestamp).toBe(task.dueAt);
        await deliveries.markDelivered(delivery.id, 'message', 'channel');
        await expect(manager.done(task.id, 'owner', 0, { id: delivery.id, messageId: 'message', channelId: 'channel' })).rejects.toMatchObject({ code: 'stale' });
        await expect(manager.done(task.id, 'owner', 1, { id: delivery.id, messageId: 'message', channelId: 'channel' })).rejects.toMatchObject({ code: 'stale' });
        const cleared = await manager.edit(task.id, 'owner', 1, { title: 'Changed', checklist: [], due: null, timezone: input.timezone });
        expect(cleared).toMatchObject({ dueAt: null, reminderId: null, recurrence: task.recurrence });
        expect(await ReminderConfig.count()).toBe(0);
    });

    it('rejects foreign, stale, completed and invalid editor writes without changing the task', async () => {
        const manager = new UserTaskManager(() => now);
        const task = await manager.create(input);
        const edit = { title: 'Changed', checklist: [], timezone: input.timezone };
        await expect(manager.edit(task.id, 'other', 0, { ...edit, timezone: 'UTC' })).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.edit(task.id, 'owner', 99, edit)).rejects.toMatchObject({ code: 'stale' });
        await expect(manager.edit(task.id, 'owner', 0, { ...edit, due: 'tomorrow' })).rejects.toMatchObject({ code: 'invalid' });
        await expect(manager.edit(task.id, 'owner', 0, { ...edit, due: '2026-10-22T10:00' })).rejects.toMatchObject({ code: 'invalid' });
        await expect(manager.edit(task.id, 'owner', 0, { ...edit, checklist: Array(11).fill({ text: 'Item', done: false }) })).rejects.toMatchObject({ code: 'invalid' });
        expect(await manager.get(task.id, 'owner')).toMatchObject({ title: input.title, version: 0, dueAt: null });
        const results = await Promise.allSettled([manager.edit(task.id, 'owner', 0, edit), manager.edit(task.id, 'owner', 0, edit)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'stale' } });
        await manager.done(task.id, 'owner', 1);
        await expect(manager.edit(task.id, 'owner', 2, edit)).rejects.toMatchObject({ code: 'stale' });
    });
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
