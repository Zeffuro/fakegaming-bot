import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { UserTask } from '../models/personal-productivity.js';
import { UserNoteConfig } from '../models/user-note-config.js';
import { UserConfig } from '../models/user-config.js';
import { normalizeNoteSourceUrl } from './userNoteManager.js';
import { getNextRecurringReminderTimestamp, type ReminderRecurrenceRule } from '../utils/reminderRecurrence.js';
import { parseReminderTime, taskTomorrowTimestamp } from '../utils/reminderTime.js';
import { serializedTransaction } from './serializedTransaction.js';
import { taskCompletionSnapshot } from './taskCompletionUndo.js';
import {
    consumePersonalDelivery, createOwnedReminder, PersonalError, removeOwnedReminder,
    requirePersonalText, requirePersonalTime, type PersonalDeliveryScope,
} from './productivityShared.js';

export interface UserTaskBoard {
    id: string; userId: string; title: string; state: 'active' | 'completed';
    checklist: Array<{ text: string; done: boolean }>;
    dueAt: number | null; timezone: string; recurrence: ReminderRecurrenceRule | null;
    reminderId: string | null; completedAt: number | null; completions: number; version: number;
    sourceNoteId: string | null; sourceUrl: string | null; canUndo: boolean;
}

export class UserTaskManager {
    constructor(private readonly now: () => number = Date.now) {}

    async create(input: {
        userId: string; title: string; checklist?: readonly string[]; dueAt?: number | null;
        timezone: string; recurrence?: ReminderRecurrenceRule | null;
    }, transaction?: Transaction): Promise<UserTaskBoard> {
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
        const create = async (activeTransaction: Transaction) => {
            await this.lockOwner(input.userId, activeTransaction);
            await this.prune(input.userId, activeTransaction);
            if (await UserTask.count({ where: { userId: input.userId, state: 'active' }, transaction: activeTransaction }) >= 100) throw new PersonalError('capacity');
            const task = await UserTask.create({
                id: randomUUID(), userId: input.userId, title, checklistJson: JSON.stringify(checklist), state: 'active',
                dueAt: input.dueAt ?? null, timezone: input.timezone,
                recurrenceUnit: input.recurrence?.unit ?? null, recurrenceInterval: input.recurrence?.interval ?? null,
                reminderId: null, completedAt: null, version: 0, completions: 0,
            }, { transaction: activeTransaction });
            await this.schedule(task, activeTransaction);
            return this.board(task);
        };
        return transaction ? create(transaction) : serializedTransaction(UserTask.sequelize!, create);
    }

    async get(id: string, userId: string): Promise<UserTaskBoard | null> {
        const task = await UserTask.findOne({ where: { id, userId } });
        return task ? this.board(task) : null;
    }

    async fromNote(input: { userId: string; noteId: string; title: string; due?: string | null; dueAt?: number | null; timezone: string }): Promise<{ task: UserTaskBoard; created: boolean }> {
        const title = requirePersonalText(input.title);
        try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { throw new PersonalError('invalid'); }
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            await this.lockOwner(input.userId, transaction);
            const note = await UserNoteConfig.findOne({ where: { id: input.noteId, discordId: input.userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!note) throw new PersonalError('missing');
            if (note.linkedTaskId) {
                const linked = await UserTask.findOne({ where: { id: note.linkedTaskId, userId: input.userId, sourceNoteId: note.id }, transaction });
                if (!linked) throw new PersonalError('stale');
                return { task: this.board(linked), created: false };
            }
            let dueAt = input.dueAt ?? null;
            if (input.due?.trim()) {
                if (!/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(input.due.trim())) throw new PersonalError('invalid');
                const parsed = parseReminderTime(input.due, input.timezone, this.now());
                if (!parsed) throw new PersonalError('invalid');
                dueAt = parsed.timestamp;
            }
            if (dueAt != null) requirePersonalTime(dueAt, this.now());
            await this.prune(input.userId, transaction);
            if (await UserTask.count({ where: { userId: input.userId, state: 'active' }, transaction }) >= 100) throw new PersonalError('capacity');
            let sourceUrl: string | null;
            try { sourceUrl = normalizeNoteSourceUrl(note.sourceUrl); } catch { sourceUrl = null; }
            const task = await UserTask.create({
                id: randomUUID(), userId: input.userId, title, checklistJson: '[]', state: 'active',
                dueAt, timezone: input.timezone, recurrenceUnit: null, recurrenceInterval: null,
                reminderId: null, completedAt: null, version: 0, completions: 0, sourceNoteId: note.id, sourceUrl,
            }, { transaction });
            await this.schedule(task, transaction);
            // Keep the binding after task deletion so delayed retries cannot recreate it.
            await note.update({ linkedTaskId: task.id }, { transaction });
            return { task: this.board(task), created: true };
        });
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
                undoCompletionJson: JSON.stringify({ version: task.version + 1, checklist: board.checklist,
                    dueAt: board.dueAt, completedAt: board.completedAt, completions: board.completions }),
            }, { transaction });
            await this.schedule(task, transaction);
            return this.board(task);
        });
    }

    async undo(id: string, userId: string, version: number): Promise<UserTaskBoard> {
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            await this.lockOwner(userId, transaction);
            const task = await UserTask.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!task) throw new PersonalError('missing');
            const snapshot = taskCompletionSnapshot(task.undoCompletionJson, version);
            if (task.version !== version || !snapshot) throw new PersonalError('stale');
            if (task.state === 'completed'
                && await UserTask.count({ where: { userId, state: 'active' }, transaction }) >= 100) throw new PersonalError('capacity');
            await removeOwnedReminder(task.reminderId, userId, transaction);
            await task.update({ state: 'active', dueAt: snapshot.dueAt, checklistJson: JSON.stringify(snapshot.checklist),
                completedAt: snapshot.completedAt, completions: snapshot.completions, version: version + 1,
                reminderId: null, undoCompletionJson: null }, { transaction });
            // Restore the deadline without replaying an already due notification.
            if (snapshot.dueAt !== null && snapshot.dueAt > this.now()) await this.schedule(task, transaction);
            return this.board(task);
        });
    }

    async edit(id: string, userId: string, version: number, input: {
        title: string; checklist: readonly { text: string; done: boolean }[]; due?: string | null; timezone: string;
    }): Promise<UserTaskBoard> {
        const title = requirePersonalText(input.title);
        if (input.checklist.length > 10) throw new PersonalError('invalid');
        const checklist = input.checklist.map(item => {
            if (typeof item.done !== 'boolean') throw new PersonalError('invalid');
            return { text: requirePersonalText(item.text), done: item.done };
        });
        try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { throw new PersonalError('invalid'); }
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            const settings = await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            if ((settings?.timezone?.trim() || 'UTC') !== input.timezone) throw new PersonalError('invalid');
            const task = await this.require(id, userId, version, transaction);
            let dueAt = task.dueAt === null ? null : Number(task.dueAt);
            if (input.due !== undefined) {
                dueAt = null;
                if (input.due !== null) {
                    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(input.due.trim())) throw new PersonalError('invalid');
                    const parsed = parseReminderTime(input.due, input.timezone, this.now());
                    if (!parsed) throw new PersonalError('invalid');
                    dueAt = parsed.timestamp;
                    requirePersonalTime(dueAt, this.now());
                }
            }
            await removeOwnedReminder(task.reminderId, userId, transaction);
            await task.update({ title, checklistJson: JSON.stringify(checklist), dueAt,
                version: task.version + 1, reminderId: null, undoCompletionJson: null }, { transaction });
            // An unchanged overdue deadline still needs a fresh version-bound delivery.
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
            await task.update({ dueAt: timestamp, version: task.version + 1, reminderId: null, undoCompletionJson: null }, { transaction });
            await this.schedule(task, transaction);
            return this.board(task);
        });
    }

    async tomorrow(id: string, userId: string, version: number, delivery?: PersonalDeliveryScope): Promise<UserTaskBoard> {
        return serializedTransaction(UserTask.sequelize!, async transaction => {
            await this.lockOwner(userId, transaction);
            const settings = await UserConfig.findByPk(userId, { transaction });
            const task = await this.require(id, userId, version, transaction);
            const timestamp = taskTomorrowTimestamp(settings?.timezone?.trim() || 'UTC', this.now(), task.dueAt === null ? null : Number(task.dueAt));
            if (timestamp === null) throw new PersonalError('invalid');
            await removeOwnedReminder(task.reminderId, userId, transaction);
            await consumePersonalDelivery(delivery, userId, task.reminderId, 'snoozed', transaction);
            await task.update({ dueAt: timestamp, version: task.version + 1, reminderId: null, undoCompletionJson: null }, { transaction });
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
            await task.update({ checklistJson: JSON.stringify(checklist), version: task.version + 1, undoCompletionJson: null }, { transaction });
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

    private async lockOwner(userId: string, transaction: Transaction): Promise<void> {
        await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
        await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
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
            sourceNoteId: task.sourceNoteId ?? null, sourceUrl: task.sourceUrl ?? null,
            canUndo: taskCompletionSnapshot(task.undoCompletionJson, task.version) !== null,
        };
    }
}
