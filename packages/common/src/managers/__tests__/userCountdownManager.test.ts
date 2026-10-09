import { beforeEach, describe, expect, it } from 'vitest';
import { UserCountdown } from '../../models/personal-productivity.js';
import { ReminderConfig } from '../../models/reminder-config.js';
import { ReminderDelivery } from '../../models/reminder-interaction.js';
import { UserCountdownManager } from '../userCountdownManager.js';
import { parseReminderTime } from '../../utils/reminderTime.js';

let now = Date.parse('2026-10-07T10:00:00Z');
const input = { userId: 'owner', title: 'Launch', timezone: 'Europe/Amsterdam', dueMessage: 'Launch now', advanceMessage: 'Launch soon' };
beforeEach(async () => {
    now = Date.parse('2026-10-07T10:00:00Z');
    await ReminderDelivery.destroy({ where: {} });
    await ReminderConfig.destroy({ where: {} });
    await UserCountdown.destroy({ where: {} });
});

describe('private countdowns', () => {
    it('stores exact dates and timezone, schedules advance and due alerts, and sorts upcoming after restart', async () => {
        const manager = new UserCountdownManager(() => now);
        const later = await manager.create({ ...input, dueAt: now + 240_000, advanceMinutes: 2 });
        const early = await manager.create({ ...input, dueAt: now + 120_000 });
        const restarted = new UserCountdownManager(() => now);
        expect((await restarted.list('owner')).map(row => row.id)).toEqual([early.id, later.id]);
        expect((await restarted.get(later.id, 'owner'))?.timezone).toBe(input.timezone);
        const reminders = await ReminderConfig.findAll({ order: [['timestamp', 'ASC']] });
        expect(reminders).toHaveLength(3);
        expect(reminders.map(row => Number(row.timestamp))).toEqual([now + 120_000, now + 120_000, now + 240_000]);
        for (const reminder of reminders) {
            expect(await restarted.forReminder(reminder.id, 'owner')).not.toBeNull();
            expect(await restarted.forReminder(reminder.id, 'other')).toBeNull();
            expect(reminder.id.length).toBeLessThanOrEqual(64);
        }
        now += 180_000;
        expect((await restarted.list('owner')).map(row => row.id)).toEqual([later.id]);
    });

    it('owner deletion cancels both alerts without affecting another owner', async () => {
        const manager = new UserCountdownManager(() => now);
        const first = await manager.create({ ...input, dueAt: now + 240_000, advanceMinutes: 1 });
        await manager.create({ ...input, userId: 'other', dueAt: now + 240_000 });
        expect(await manager.get(first.id, 'other')).toBeNull();
        expect(await manager.remove(first.id, 'other')).toBe(false);
        expect(await manager.remove(first.id, 'owner')).toBe(true);
        expect(await manager.remove(first.id, 'owner')).toBe(false);
        expect(await ReminderConfig.count()).toBe(1);
        expect(await manager.forReminder(`countdown:${first.id}:due`, 'owner')).toBeNull();
    });

    it('rejects past advance alerts and invalid timezones and uses deterministic DST date parsing', async () => {
        const manager = new UserCountdownManager(() => now);
        await expect(manager.create({ ...input, dueAt: now + 60_000, advanceMinutes: 1 })).rejects.toMatchObject({ code: 'invalid' });
        await expect(manager.create({ ...input, dueAt: now + 60_000, timezone: 'bad' })).rejects.toMatchObject({ code: 'invalid' });
        expect(parseReminderTime('2027-03-28 02:30', input.timezone, now)).toBeNull();
        expect(parseReminderTime('2026-10-25 02:30', input.timezone, now)).toBeNull();
        const parsed = parseReminderTime('2026-10-25T02:30:00+02:00', input.timezone, now);
        expect(parsed?.timestamp).toBe(Date.parse('2026-10-25T00:30:00Z'));
        expect((await manager.create({ ...input, dueAt: parsed!.timestamp })).dueAt).toBe(parsed!.timestamp);
        expect(await ReminderConfig.count()).toBe(1);
    });
});
