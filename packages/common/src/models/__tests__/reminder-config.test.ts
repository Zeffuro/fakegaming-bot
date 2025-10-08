import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { ReminderConfig } from '../reminder-config.js';
import { Op } from 'sequelize';

describe('ReminderConfig Model', () => {
  beforeEach(async () => {
    // Clean up before each test
    await configManager.reminderManager.removeAll();
  });

  it('should create a reminder with required fields', async () => {
    const reminder = await ReminderConfig.create({
      id: 'reminder-123',
      userId: 'user-456',
      message: 'Test reminder',
      timespan: '1h',
      timestamp: Date.now(),
    });

    expect(reminder.id).toBe('reminder-123');
    expect(reminder.userId).toBe('user-456');
    expect(reminder.message).toBe('Test reminder');
    expect(reminder.timespan).toBe('1h');
    expect(reminder.timestamp).toBeTypeOf('number');
  });

  it('should find reminders by userId', async () => {
    await ReminderConfig.create({
      id: 'reminder-1',
      userId: 'user-test',
      message: 'Reminder 1',
      timespan: '1h',
      timestamp: Date.now(),
    });

    await ReminderConfig.create({
      id: 'reminder-2',
      userId: 'user-test',
      message: 'Reminder 2',
      timespan: '2h',
      timestamp: Date.now(),
    });

    const reminders = await ReminderConfig.findAll({
      where: { userId: 'user-test' },
    });

    expect(reminders).toHaveLength(2);
    expect(reminders.every(r => r.userId === 'user-test')).toBe(true);
  });

  it('should find due reminders by timestamp', async () => {
    const pastTimestamp = Date.now() - 1000 * 60 * 60; // 1 hour ago
    const futureTimestamp = Date.now() + 1000 * 60 * 60; // 1 hour from now

    await ReminderConfig.create({
      id: 'reminder-past',
      userId: 'user-past',
      message: 'Past reminder',
      timespan: '1h',
      timestamp: pastTimestamp,
    });

    await ReminderConfig.create({
      id: 'reminder-future',
      userId: 'user-future',
      message: 'Future reminder',
      timespan: '1h',
      timestamp: futureTimestamp,
    });

    const dueReminders = await ReminderConfig.findAll({
      where: {
        timestamp: {
          [Op.lte]: Date.now(),
        },
      },
    });

    expect(dueReminders.some(r => r.id === 'reminder-past')).toBe(true);
  });

  it('should delete a reminder', async () => {
    const reminder = await ReminderConfig.create({
      id: 'reminder-delete',
      userId: 'user-delete',
      message: 'Delete me',
      timespan: '1h',
      timestamp: Date.now(),
    });

    await reminder.destroy();

    const deleted = await ReminderConfig.findByPk('reminder-delete');
    expect(deleted).toBeNull();
  });

  it('should mark reminder as completed', async () => {
    const reminder = await ReminderConfig.create({
      id: 'reminder-complete',
      userId: 'user-complete',
      message: 'Complete me',
      timespan: '1h',
      timestamp: Date.now(),
      completed: false,
    });

    reminder.completed = true;
    await reminder.save();

    const updated = await ReminderConfig.findByPk('reminder-complete');
    expect(updated?.completed).toBe(true);
  });
});
