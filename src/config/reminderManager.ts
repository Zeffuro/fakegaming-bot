import {BaseManager} from './baseManager.js';
import {ReminderConfig} from '../types/reminderConfig.js';

/**
 * Manages reminder records for users.
 */
export class ReminderManager extends BaseManager<ReminderConfig> {
    /**
     * Creates a new ReminderManager.
     */
    constructor() {
        super('reminders');
    }

    /**
     * Gets all reminders for a user.
     * @param userId The user's ID.
     * @returns An array of reminders for the user.
     */
    getRemindersByUser({userId}: { userId: string }): ReminderConfig[] {
        return this.collection.filter(reminder => reminder.userId === userId);
    }

    /**
     * Removes a reminder by its ID.
     * @param id The reminder's ID.
     */
    async removeReminder({id}: { id: string }) {
        const filtered = this.collection.filter(reminder => reminder.id !== id);
        await this.setAll(filtered);
    }
}