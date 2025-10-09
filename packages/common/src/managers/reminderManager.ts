import {BaseManager} from './baseManager.js';
import {ReminderConfig} from '../models/reminder-config.js';

export class ReminderManager extends BaseManager<ReminderConfig> {
    constructor() {
        super(ReminderConfig);
    }

    /** Get all reminders as plain objects */
    async getAllPlain() {
        return this.getAll({ raw: true });
    }

    /** Get all reminders for a user as plain objects */
    async getRemindersByUser(userId: string) {
        return this.getMany({ userId }, { raw: true });
    }

    /** Remove a reminder by id */
    async removeReminder(id: string) {
        await this.remove({ id });
    }

    /** Add a new reminder */
    async addReminder(data: Partial<ReminderConfig> & { id: string }) {
        return this.add(data, { raw: true });
    }
}