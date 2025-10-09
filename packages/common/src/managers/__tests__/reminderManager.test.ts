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
});
