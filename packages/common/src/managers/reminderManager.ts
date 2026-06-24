import {BaseManager} from './baseManager.js';
import {ReminderConfig} from '../models/reminder-config.js';
import type {ReminderRecurrenceUnit} from '../utils/reminderRecurrence.js';

export interface UserReminderCreateInput {
    id: string;
    userId: string;
    message: string;
    timespan: string;
    timestamp: number;
    recurrenceUnit?: ReminderRecurrenceUnit | null;
    recurrenceInterval?: number | null;
    recurrenceTimezone?: string | null;
}

export interface UserReminderSnoozeInput {
    timespan: string;
    timestamp: number;
}

export interface UserReminderPausedInput {
    paused: boolean;
    timestamp?: number;
}

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

    async listForUser(userId: string) {
        return this.model.findAll({
            where: { userId },
            order: [['timestamp', 'ASC']],
            raw: true,
        });
    }

    async getForUser(id: string, userId: string) {
        return this.getOnePlain({ id, userId });
    }

    async createForUser(input: UserReminderCreateInput) {
        return this.addPlain({
            id: input.id,
            userId: input.userId,
            message: input.message,
            timespan: input.timespan,
            timestamp: input.timestamp,
            completed: false,
            recurrenceUnit: input.recurrenceUnit ?? null,
            recurrenceInterval: input.recurrenceInterval ?? null,
            recurrenceTimezone: input.recurrenceTimezone ?? null,
            lastTriggeredAt: null,
        });
    }

    async snoozeForUser(id: string, userId: string, input: UserReminderSnoozeInput) {
        const existing = await this.getForUser(id, userId);
        if (!existing) return null;

        await this.updatePlain({
            timespan: input.timespan,
            timestamp: input.timestamp,
        } as never, { id, userId } as never);
        return this.getForUser(id, userId);
    }

    async rescheduleRecurringReminder(id: string, timestamp: number, lastTriggeredAt: number) {
        await this.updatePlain({
            timestamp,
            lastTriggeredAt,
            completed: false,
        } as never, { id } as never);
    }

    async setPausedForUser(id: string, userId: string, input: UserReminderPausedInput) {
        const existing = await this.getForUser(id, userId);
        if (!existing) return null;

        await this.updatePlain({
            completed: input.paused,
            ...(input.timestamp !== undefined ? { timestamp: input.timestamp } : {}),
        } as never, { id, userId } as never);
        return this.getForUser(id, userId);
    }

    async removeForUser(id: string, userId: string): Promise<boolean> {
        const deleted = await this.model.destroy({ where: { id, userId } as never });
        return deleted > 0;
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
