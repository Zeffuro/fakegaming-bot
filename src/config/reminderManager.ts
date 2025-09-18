import {db} from './db.js';
import {ReminderConfig} from '../types/reminderConfig.js';

export class ReminderManager {
    async addReminder(reminder: ReminderConfig) {
        db.data!.reminders = db.data!.reminders || [];
        db.data!.reminders.push(reminder);
        await db.write();
    }

    getAllReminders(): ReminderConfig[] {
        return db.data!.reminders || [];
    }

    getRemindersByUser({userId}: { userId: string }): ReminderConfig[] {
        return (db.data!.reminders || []).filter(reminder => reminder.userId === userId);
    }

    async removeReminder({id}: { id: string }) {
        db.data!.reminders = (db.data!.reminders || []).filter(reminder => reminder.id !== id);
        await db.write();
    }
}