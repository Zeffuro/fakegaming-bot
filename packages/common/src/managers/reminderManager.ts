import {BaseManager} from './baseManager.js';
import {ReminderConfig} from '../models/reminder-config.js';

export class ReminderManager extends BaseManager<ReminderConfig> {
    constructor() {
        super(ReminderConfig);
    }

    async getRemindersByUser({userId}: { userId: string }): Promise<ReminderConfig[]> {
        return (await this.getMany({userId})).map(r => r.get());
    }

    async removeReminder({id}: { id: string }) {
        await this.remove({id});
    }
}