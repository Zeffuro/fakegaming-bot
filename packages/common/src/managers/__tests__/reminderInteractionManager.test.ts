import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReminderInteractionManager, REMINDER_DELIVERY_RETENTION_MS } from '../reminderInteractionManager.js';
import { ReminderDelivery, ReminderDraft } from '../../models/reminder-interaction.js';
import { ReminderConfig } from '../../models/reminder-config.js';

describe('ReminderInteractionManager', () => {
    let now = 1_800_000_000_000;
    const manager = new ReminderInteractionManager(() => now);

    beforeEach(async () => {
        now = 1_800_000_000_000;
        await ReminderDelivery.destroy({ where: {} });
        await ReminderDraft.destroy({ where: {} });
        await ReminderConfig.destroy({ where: {} });
    });

    it('persists a draft across manager recreation, with owner and single-use enforcement', async () => {
        const draft = await manager.createDraft('owner', 'original message link');
        const restarted = new ReminderInteractionManager(() => now);
        expect((await restarted.getDraft(draft.id, 'owner'))?.message).toBe('original message link');
        expect(await restarted.getDraft(draft.id, 'other')).toBeNull();
        expect(await restarted.scheduleDraft(draft.id, 'other', now + 600_000, '10m')).toBe(false);
        const results = await Promise.all([
            manager.scheduleDraft(draft.id, 'owner', now + 600_000, '10m'),
            restarted.scheduleDraft(draft.id, 'owner', now + 600_000, '10m'),
        ]);
        expect(results.sort()).toEqual([false, true]);
        expect(await ReminderConfig.count()).toBe(1);
        expect(await manager.getDraft(draft.id, 'owner')).toBeNull();
    });

    it('rejects expired drafts and invalid scheduling times', async () => {
        const draft = await manager.createDraft('owner', 'message');
        expect(await manager.scheduleDraft(draft.id, 'owner', now, '1m')).toBe(false);
        expect(await manager.scheduleDraft(draft.id, 'owner', now + 1_000, '')).toBe(false);
        now += 31 * 60_000;
        expect(await manager.scheduleDraft(draft.id, 'owner', now + 60_000, '1m')).toBe(false);
        await manager.prune();
        expect(await ReminderDraft.count()).toBe(0);
    });

    it('snapshots each delivery once and snoozes it once without changing recurrence', async () => {
        await ReminderConfig.create({ id: 'recurring', userId: 'owner', message: 'weekly task', timestamp: now + 7 * 86_400_000, timespan: '1h', recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceTimezone: 'UTC' });
        const delivery = await manager.prepareDelivery({ id: 'recurring', userId: 'owner', message: 'weekly task' }, now);
        expect((await manager.prepareDelivery({ id: 'recurring', userId: 'owner', message: 'changed' }, now)).id).toBe(delivery.id);
        expect(await manager.getDelivery(delivery.id, 'owner')).toBeNull();
        await manager.markDelivered(delivery.id, 'dm-message', 'dm-channel');
        const restarted = new ReminderInteractionManager(() => now);
        expect(await restarted.getDelivery(delivery.id, 'other')).toBeNull();
        expect(await restarted.snoozeDelivery(delivery.id, 'owner', now + 600_000, '10m', 'forged-message', 'dm-channel')).toBe(false);
        const results = await Promise.all([
            manager.snoozeDelivery(delivery.id, 'owner', now + 600_000, '10m', 'dm-message', 'dm-channel'),
            restarted.snoozeDelivery(delivery.id, 'owner', now + 600_000, '10m', 'dm-message', 'dm-channel'),
        ]);
        expect(results.sort()).toEqual([false, true]);
        const original = await ReminderConfig.findByPk('recurring');
        expect(Number(original?.timestamp)).toBe(now + 7 * 86_400_000);
        const followUp = await ReminderConfig.findOne({ where: { recurrenceUnit: null } });
        expect(followUp?.message).toBe('weekly task');
        expect(Number(followUp?.timestamp)).toBe(now + 600_000);
        expect(await manager.getDelivery(delivery.id, 'owner')).toBeNull();
    });

    it('rolls back the single-use claim if saving a follow-up fails', async () => {
        const delivery = await manager.prepareDelivery({ id: 'oneoff', userId: 'owner', message: 'task' }, now);
        await manager.markDelivered(delivery.id, 'message', 'channel');
        const create = vi.spyOn(ReminderConfig, 'create').mockRejectedValueOnce(new Error('save failed'));
        await expect(manager.snoozeDelivery(delivery.id, 'owner', now + 60_000, '1m', 'message', 'channel')).rejects.toThrow('save failed');
        create.mockRestore();
        expect(await manager.getDelivery(delivery.id, 'owner')).not.toBeNull();
        expect(await manager.snoozeDelivery(delivery.id, 'owner', now + 60_000, '1m', 'message', 'channel')).toBe(true);
    });

    it('dismisses only the original owner-bound message and expires delivered state', async () => {
        const delivery = await manager.prepareDelivery({ id: 'oneoff', userId: 'owner', message: 'task' }, now);
        await manager.markDelivered(delivery.id, 'message', 'channel');
        expect(await manager.dismissDelivery(delivery.id, 'other', 'message', 'channel')).toBe(false);
        expect(await manager.dismissDelivery(delivery.id, 'owner', 'message', 'other-channel')).toBe(false);
        expect(await manager.dismissDelivery(delivery.id, 'owner', 'message', 'channel')).toBe(true);
        expect(await manager.dismissDelivery(delivery.id, 'owner', 'message', 'channel')).toBe(false);
        expect(await ReminderConfig.count()).toBe(0);
        now += REMINDER_DELIVERY_RETENTION_MS;
        expect(await manager.getDelivery(delivery.id, 'owner')).toBeNull();
        await manager.prune();
        expect(await ReminderDelivery.count()).toBe(0);
    });

    it('claims a send once, reuses its occurrence after backoff, and binds uncertain recovery once', async () => {
        const source = { id: 'source', userId: 'owner', message: 'task' };
        await ReminderConfig.create({ ...source, timestamp: now, timespan: '1h' });
        const delivery = await manager.prepareDelivery(source, now);
        expect((await manager.prepareDelivery(source, now + 60_000)).id).toBe(delivery.id);
        expect(await manager.claimDelivery(delivery.id)).toBe(true);
        expect(await manager.claimDelivery(delivery.id)).toBe(false);
        expect(Number((await manager.getDelivery(delivery.id, 'owner'))?.attemptedAt)).toBe(now);
        await manager.markUncertain(delivery.id);
        expect(await manager.recoverDelivery(delivery.id, 'other', 'message', 'channel')).toBeNull();
        const recovered = await manager.recoverDelivery(delivery.id, 'owner', 'message', 'channel');
        expect(recovered).toMatchObject({ status: 'delivered', messageId: 'message', channelId: 'channel' });
        expect(await manager.recoverDelivery(delivery.id, 'owner', 'forged', 'channel')).toMatchObject({ messageId: 'message' });
        await manager.finalizeDelivery(delivery.id, now + 86_400_000, now);
        const nextOccurrence = await manager.prepareDelivery(source, now + 86_400_000);
        expect(nextOccurrence.id).not.toBe(delivery.id);
    });

    it('releases only a known-rejected send for safe retry', async () => {
        await ReminderConfig.create({ id: 'source', userId: 'owner', message: 'task', timestamp: now, timespan: '1h' });
        const delivery = await manager.prepareDelivery({ id: 'source', userId: 'owner', message: 'task' }, now);
        await manager.claimDelivery(delivery.id);
        await manager.releaseDelivery(delivery.id);
        expect(await manager.getDelivery(delivery.id, 'owner')).toBeNull();
        expect(await manager.claimDelivery(delivery.id)).toBe(true);
    });

    it('retains the same occurrence through rejection, retry and failed source finalization', async () => {
        const source = { id: 'source', userId: 'owner', message: 'task' };
        await ReminderConfig.create({ ...source, timestamp: now, timespan: '1h' });
        const first = await manager.prepareDelivery(source, now);
        await manager.claimDelivery(first.id);
        await manager.releaseDelivery(first.id, now + 60_000);
        now += 60_000;
        expect((await manager.prepareDelivery(source, now)).id).toBe(first.id);
        await manager.claimDelivery(first.id);
        await manager.markDelivered(first.id, 'message', 'channel');
        const destroy = vi.spyOn(ReminderConfig, 'destroy').mockRejectedValueOnce(new Error('cleanup failed'));
        await expect(manager.finalizeDelivery(first.id, null, now)).rejects.toThrow('cleanup failed');
        destroy.mockRestore();
        expect((await new ReminderInteractionManager(() => now).prepareDelivery(source, now)).id).toBe(first.id);
        expect(await manager.claimDelivery(first.id)).toBe(false);
        await manager.finalizeDelivery(first.id, null, now);
        expect(await ReminderConfig.count()).toBe(0);
        expect((await ReminderDelivery.findByPk(first.id))?.finalized).toBe(true);
    });

    it('finalizes recurrence atomically without unpausing it or losing the delivered snapshot', async () => {
        const source = { id: 'recurring', userId: 'owner', message: 'task' };
        await ReminderConfig.create({ ...source, timestamp: now, timespan: '1h', completed: false, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceTimezone: 'UTC' });
        const delivery = await manager.prepareDelivery(source, now);
        await manager.claimDelivery(delivery.id);
        await ReminderConfig.update({ completed: true }, { where: { id: source.id } });
        await manager.markUncertain(delivery.id);
        await manager.finalizeDelivery(delivery.id, now + 86_400_000, now);
        expect(await ReminderConfig.findByPk(source.id)).toMatchObject({ completed: true, timestamp: now + 86_400_000, lastTriggeredAt: now });
        expect((await manager.prepareDelivery(source, now + 86_400_000)).id).not.toBe(delivery.id);
    });

    it('keeps unresolved replay guards past button expiry until the source is finalized', async () => {
        const source = { id: 'source', userId: 'owner', message: 'task' };
        await ReminderConfig.create({ ...source, timestamp: now, timespan: '1h' });
        const delivery = await manager.prepareDelivery(source, now);
        await manager.claimDelivery(delivery.id);
        await manager.markUncertain(delivery.id);
        now += REMINDER_DELIVERY_RETENTION_MS + 1;
        await manager.prune();
        expect(await manager.getDelivery(delivery.id, 'owner')).toBeNull();
        expect((await manager.prepareDelivery(source, now)).id).toBe(delivery.id);
        await manager.finalizeDelivery(delivery.id, null, now);
        await manager.prune();
        expect(await ReminderDelivery.count()).toBe(0);
    });

    it('retires a stale pending occurrence while preserving the new snoozed source', async () => {
        const source = { id: 'source', userId: 'owner', message: 'task' };
        await ReminderConfig.create({ ...source, timestamp: now, timespan: '1h' });
        const delivery = await manager.prepareDelivery(source, now);
        await ReminderConfig.update({ timestamp: now + 600_000 }, { where: { id: source.id } });
        expect(await manager.claimDelivery(delivery.id, now)).toBe(false);
        expect(await ReminderDelivery.findByPk(delivery.id)).toMatchObject({ status: 'dismissed', finalized: true });
        expect((await manager.prepareDelivery(source, now + 600_000)).id).not.toBe(delivery.id);
    });

    it.each(['delivered', 'uncertain'])('preserves a snooze across failed %s finalization and manager restart', async status => {
        const source = { id: 'source', userId: 'owner', message: 'task' };
        await ReminderConfig.create({ ...source, timestamp: now, timespan: '1h' });
        const delivery = await manager.prepareDelivery(source, now);
        await manager.claimDelivery(delivery.id, now);
        if (status === 'delivered') await manager.markDelivered(delivery.id, 'message', 'channel');
        else await manager.markUncertain(delivery.id);
        const nextTimestamp = now + 600_000;
        await ReminderConfig.update({ timestamp: nextTimestamp }, { where: { id: source.id } });
        const update = vi.spyOn(ReminderDelivery, 'update').mockRejectedValueOnce(new Error('settlement unavailable'));
        await expect(manager.finalizeDelivery(delivery.id, null, now)).rejects.toThrow('settlement unavailable');
        update.mockRestore();
        const restarted = new ReminderInteractionManager(() => now);
        expect(await restarted.claimDelivery(delivery.id, nextTimestamp)).toBe(false);
        await restarted.finalizeDelivery(delivery.id, null, now);
        expect(Number((await ReminderConfig.findByPk(source.id))?.timestamp)).toBe(nextTimestamp);
        expect(await ReminderDelivery.findByPk(delivery.id)).toMatchObject({ status, finalized: true, sourceTimestamp: now });
        expect((await restarted.prepareDelivery(source, nextTimestamp)).id).not.toBe(delivery.id);
    });
});
