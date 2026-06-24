import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { ReminderConfig } from '../../models/reminder-config.js';

describe('ReminderManager', () => {
    const reminderManager = configManager.reminderManager;

    beforeEach(async () => {
        await reminderManager.removeAll();
    });

    describe('getRemindersByUser', () => {
        it('should return all reminders for a user', async () => {
            await ReminderConfig.create({
                id: 'reminder-1',
                userId: 'user-1',
                message: 'Test reminder 1',
                timespan: '1h',
                timestamp: Date.now(),
            });

            await ReminderConfig.create({
                id: 'reminder-2',
                userId: 'user-1',
                message: 'Test reminder 2',
                timespan: '2h',
                timestamp: Date.now(),
            });

            await ReminderConfig.create({
                id: 'reminder-3',
                userId: 'user-2',
                message: 'Test reminder 3',
                timespan: '1h',
                timestamp: Date.now(),
            });

            const reminders = await reminderManager.getRemindersByUser('user-1');

            expect(reminders).toHaveLength(2);
            expect(reminders.every(r => r.userId === 'user-1')).toBe(true);
        });

        it('should return empty array if user has no reminders', async () => {
            const reminders = await reminderManager.getRemindersByUser('no-reminders');
            expect(reminders).toEqual([]);
        });
    });

    describe('removeReminder', () => {
        it('should remove a reminder by id', async () => {
            const reminder = await ReminderConfig.create({
                id: 'reminder-to-delete',
                userId: 'user-1',
                message: 'Test reminder',
                timespan: '1h',
                timestamp: Date.now(),
            });

            await reminderManager.removeReminder(reminder.id!);

            await expect(async () => {
                await reminderManager.findByPk(reminder.id!);
            }).rejects.toThrow('Item not found');
        });
    });

    describe('addReminder/getAllPlain', () => {
        it('adds a reminder and returns plain reminders', async () => {
            const created = await reminderManager.addReminder({
                id: 'created-reminder',
                userId: 'user-1',
                message: 'Created reminder',
                timespan: '1h',
                timestamp: Date.now(),
            });

            const reminders = await reminderManager.getAllPlain();

            expect(created.id).toBe('created-reminder');
            expect(reminders).toHaveLength(1);
            expect(reminders[0]?.message).toBe('Created reminder');
        });

        it('creates and reschedules recurring user reminders', async () => {
            const created = await reminderManager.createForUser({
                id: 'recurring-reminder',
                userId: 'user-1',
                message: 'Weekly reminder',
                timespan: '1h',
                timestamp: 1_000,
                recurrenceUnit: 'week',
                recurrenceInterval: 1,
                recurrenceTimezone: 'UTC',
            });

            expect(created).toMatchObject({
                id: 'recurring-reminder',
                recurrenceUnit: 'week',
                recurrenceInterval: 1,
                recurrenceTimezone: 'UTC',
                lastTriggeredAt: null,
            });

            await reminderManager.rescheduleRecurringReminder('recurring-reminder', 2_000, 1_500);
            const updated = await reminderManager.getForUser('recurring-reminder', 'user-1');
            expect(updated).toMatchObject({
                timestamp: 2_000,
                lastTriggeredAt: 1_500,
            });
            expect(Boolean(updated?.completed)).toBe(false);

            await reminderManager.setPausedForUser('recurring-reminder', 'user-1', { paused: true });
            const paused = await reminderManager.getForUser('recurring-reminder', 'user-1');
            expect(Boolean(paused?.completed)).toBe(true);

            await reminderManager.setPausedForUser('recurring-reminder', 'user-1', { paused: false, timestamp: 3_000 });
            const resumed = await reminderManager.getForUser('recurring-reminder', 'user-1');
            expect(Boolean(resumed?.completed)).toBe(false);
            expect(resumed?.timestamp).toBe(3_000);
        });
    });
});
