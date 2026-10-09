import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { UserTask } from '../models/personal-productivity.js';
import { getNextRecurringReminderTimestamp, type ReminderRecurrenceRule } from '../utils/reminderRecurrence.js';
import { serializedTransaction } from './serializedTransaction.js';
import {
    consumePersonalDelivery, createOwnedReminder, PersonalError, removeOwnedReminder,
    requirePersonalText, requirePersonalTime, type PersonalDeliveryScope,
} from './productivityShared.js';

export interface UserTaskBoard {
    id: string; userId: string; title: string; state: 'active' | 'completed';
    checklist: Array<{ text: string; done: boolean }>;
    dueAt: number | null; timezone: string; recurrence: ReminderRecurrenceRule | null;
    reminderId: string | null; completedAt: number | null; completions: number; version: number;
}

export class UserTaskManager {
    constructor(private readonly now: () => number = Date.now) {}

    async create(input: {
        userId: string; title: string; checklist?: readonly string[]; dueAt?: number | null;
        timezone: string; recurrence?: ReminderRecurrenceRule | null;
    }): Promise<UserTaskBoard> {
        const title = requirePersonalText(input.title);
        const checklist = (input.checklist ?? []).map(text => ({ text: requirePersonalText(text), done: false }));
        if (!input.userId || checklist.length > 10) throw new PersonalError('invalid');
        if (input.dueAt != null) requirePersonalTime(input.dueAt, this.now());
        try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { throw new PersonalError('invalid'); }
        if (input.recurrence && (input.recurrence.timezone !== input.timezone || !['day', 'week', 'month'].includes(input.recurrence.unit)
            || !Number.isInteger(input.recurrence.interval) || input.recurrence.interval < 1
            || input.recurrence.interval > ({ day: 365, week: 52, month: 24 }[input.recurrence.unit] ?? 0)
            || !getNextRecurringReminderTimestamp({ rule: input.recurrence, previousTimestamp: this.now() }))) {
            throw new PersonalError('invalid');
        }
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            await this.prune(input.userId, transaction);
            if (await UserTask.count({ where: { userId: input.userId, state: 'active' }, transaction }) >= 100) throw new PersonalError('capacity');
            const task = await UserTask.create({
                id: randomUUID(), userId: input.userId, title, checklistJson: JSON.stringify(checklist), state: 'active',
                dueAt: input.dueAt ?? null, timezone: input.timezone,
                recurrenceUnit: input.recurrence?.unit ?? null, recurrenceInterval: input.recurrence?.interval ?? null,
                reminderId: null, completedAt: null, version: 0, completions: 0,
            }, { transaction });
            await this.schedule(task, transaction);
            return this.board(task);
        });
    }

    async get(id: string, userId: string): Promise<UserTaskBoard | null> {
        const task = await UserTask.findOne({ where: { id, userId } });
        return task ? this.board(task) : null;
    }

    async list(userId: string, completed = false): Promise<UserTaskBoard[]> {
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            await this.prune(userId, transaction);
            const tasks = await UserTask.findAll({ where: { userId, state: completed ? 'completed' : 'active' }, order: [['createdAt', 'ASC']], transaction });
            return tasks.map(task => this.board(task)).sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.id.localeCompare(b.id));
        });
    }

    async done(id: string, userId: string, version: number, delivery?: PersonalDeliveryScope): Promise<UserTaskBoard> {
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            const task = await this.require(id, userId, version, transaction);
            await removeOwnedReminder(task.reminderId, userId, transaction);
            await consumePersonalDelivery(delivery, userId, task.reminderId, 'dismissed', transaction);
            const board = this.board(task);
            const now = this.now();
            const nextDue = board.recurrence ? getNextRecurringReminderTimestamp({ rule: board.recurrence, previousTimestamp: now }) : null;
            if (board.recurrence && nextDue === null) throw new PersonalError('invalid');
            await task.update({
                state: board.recurrence ? 'active' : 'completed', dueAt: nextDue,
                checklistJson: JSON.stringify(board.checklist.map(item => ({ ...item, done: !board.recurrence }))),
                completedAt: now, completions: task.completions + 1, version: task.version + 1, reminderId: null,
            }, { transaction });
            await this.schedule(task, transaction);
            return this.board(task);
        });
    }

    async snooze(id: string, userId: string, version: number, timestamp: number, delivery?: PersonalDeliveryScope): Promise<UserTaskBoard> {
        requirePersonalTime(timestamp, this.now());
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            const task = await this.require(id, userId, version, transaction);
            await removeOwnedReminder(task.reminderId, userId, transaction);
            await consumePersonalDelivery(delivery, userId, task.reminderId, 'snoozed', transaction);
            await task.update({ dueAt: timestamp, version: task.version + 1, reminderId: null }, { transaction });
            await this.schedule(task, transaction);
            return this.board(task);
        });
    }

    async check(id: string, userId: string, version: number, index: number): Promise<UserTaskBoard> {
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            const task = await this.require(id, userId, version, transaction);
            const checklist = this.board(task).checklist;
            const item = checklist[index];
            if (!Number.isInteger(index) || !item) throw new PersonalError('invalid');
            item.done = !item.done;
            const pending = task.dueAt !== null && Number(task.dueAt) > this.now();
            if (pending) await removeOwnedReminder(task.reminderId, userId, transaction);
            await task.update({ checklistJson: JSON.stringify(checklist), version: task.version + 1 }, { transaction });
            if (pending) await this.schedule(task, transaction);
            return this.board(task);
        });
    }

    async remove(id: string, userId: string): Promise<boolean> {
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            const task = await UserTask.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!task) return false;
            await removeOwnedReminder(task.reminderId, userId, transaction);
            await task.destroy({ transaction });
            return true;
        });
    }

    async forReminder(reminderId: string, userId: string): Promise<UserTaskBoard | null> {
        const task = await UserTask.findOne({ where: { reminderId, userId, state: 'active' } });
        return task ? this.board(task) : null;
    }

    private async require(id: string, userId: string, version: number, transaction: Transaction): Promise<UserTask> {
        const task = await UserTask.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
        if (!task) throw new PersonalError('missing');
        if (task.state !== 'active' || task.version !== version) throw new PersonalError('stale');
        return task;
    }

    private async schedule(task: UserTask, transaction: Transaction): Promise<void> {
        if (task.state !== 'active' || task.dueAt === null) return;
        const reminderId = `task:${task.id}:${task.version}`;
        await createOwnedReminder(reminderId, task.userId, task.title, Number(task.dueAt), this.now(), transaction);
        await task.update({ reminderId }, { transaction });
    }

    private async prune(userId: string, transaction: Transaction): Promise<void> {
        await UserTask.destroy({ where: { userId, state: 'completed', completedAt: { [Op.lt]: this.now() - 90 * 86_400_000 } }, transaction });
        const old = await UserTask.findAll({ where: { userId, state: 'completed' }, order: [['completedAt', 'DESC']], offset: 1_000, transaction });
        if (old.length) await UserTask.destroy({ where: { userId, id: { [Op.in]: old.map(task => task.id) } }, transaction });
    }

    private board(task: UserTask): UserTaskBoard {
        const checklist: unknown = JSON.parse(task.checklistJson);
        if (!Array.isArray(checklist) || checklist.length > 10 || !checklist.every(item => item && typeof item.text === 'string' && typeof item.done === 'boolean')) {
            throw new Error('Invalid persisted task checklist');
        }
        return {
            id: task.id, userId: task.userId, title: task.title, state: task.state, checklist,
            dueAt: task.dueAt === null ? null : Number(task.dueAt), timezone: task.timezone,
            recurrence: task.recurrenceUnit && task.recurrenceInterval ? { unit: task.recurrenceUnit, interval: task.recurrenceInterval, timezone: task.timezone } : null,
            reminderId: task.reminderId, completedAt: task.completedAt === null ? null : Number(task.completedAt), completions: task.completions, version: task.version,
        };
    }
}
