import {BaseManager} from './baseManager.js';
import {ReminderConfig} from '../types/reminderConfig.js';

export class ReminderManager extends BaseManager<ReminderConfig> {
    constructor() {
        super('reminders');
    }

    getRemindersByUser({userId}: { userId: string }): ReminderConfig[] {
        return this.collection.filter(reminder => reminder.userId === userId);
    }

    async removeReminder({id}: { id: string }) {
        const filtered = this.collection.filter(reminder => reminder.id !== id);
        await this.setAll(filtered);
    }
}