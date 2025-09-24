import { BaseManager } from './baseManager.js';
import { ReminderConfig } from '../models/reminder-config.js';
/**
 * Manages reminder records for users.
 */
export class ReminderManager extends BaseManager {
    constructor() {
        super(ReminderConfig);
    }
    async getRemindersByUser({ userId }) {
        return await this.getMany({ userId });
    }
    async removeReminder({ id }) {
        await this.remove({ id });
    }
}
