import { randomUUID } from 'node:crypto';
import { UserChecklistTemplate } from '../models/user-checklist-template.js';
import { UserConfig } from '../models/user-config.js';
import { parseReminderTime } from '../utils/reminderTime.js';
import type { UserTaskManager, UserTaskBoard } from './userTaskManager.js';
import { serializedTransaction } from './serializedTransaction.js';
import { PersonalError, requirePersonalText } from './productivityShared.js';

export interface ChecklistTemplate {
    id: string; title: string; items: string[]; version: number;
}

function values(title: string, items: readonly string[]) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 10) throw new PersonalError('invalid');
    return { title: requirePersonalText(title), itemsJson: JSON.stringify(items.map(item => requirePersonalText(item))) };
}

function board(row: UserChecklistTemplate): ChecklistTemplate {
    const items: unknown = JSON.parse(row.itemsJson);
    if (!Array.isArray(items) || !items.every(item => typeof item === 'string')) throw new Error('Invalid persisted checklist template');
    return { id: row.id, title: row.title, items, version: row.version };
}

export class UserChecklistTemplateManager {
    constructor(private readonly now: () => number = Date.now) {}
    async list(userId: string): Promise<ChecklistTemplate[]> {
        return (await UserChecklistTemplate.findAll({ where: { userId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] })).map(board);
    }

    async get(id: string, userId: string): Promise<ChecklistTemplate | null> {
        const row = await UserChecklistTemplate.findOne({ where: { id, userId } });
        return row ? board(row) : null;
    }

    async create(userId: string, title: string, items: readonly string[]): Promise<ChecklistTemplate> {
        if (!userId) throw new PersonalError('invalid');
        const data = values(title, items);
        return serializedTransaction(UserChecklistTemplate.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            if (await UserChecklistTemplate.count({ where: { userId }, transaction }) >= 50) throw new PersonalError('capacity');
            return board(await UserChecklistTemplate.create({ id: randomUUID(), userId, ...data, version: 0 }, { transaction }));
        });
    }

    async edit(id: string, userId: string, version: number, title: string, items: readonly string[]): Promise<ChecklistTemplate> {
        const data = values(title, items);
        return serializedTransaction(UserChecklistTemplate.sequelize!, async transaction => {
            const row = await UserChecklistTemplate.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) throw new PersonalError('missing');
            if (row.version !== version) throw new PersonalError('stale');
            return board(await row.update({ ...data, version: row.version + 1 }, { transaction }));
        });
    }

    async remove(id: string, userId: string, version: number): Promise<void> {
        return serializedTransaction(UserChecklistTemplate.sequelize!, async transaction => {
            const row = await UserChecklistTemplate.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) throw new PersonalError('missing');
            if (row.version !== version) throw new PersonalError('stale');
            await row.destroy({ transaction });
        });
    }

    async start(id: string, userId: string, version: number, tasks: UserTaskManager,
        input: { due?: string | null; timezone?: string; exact?: boolean } = {}): Promise<UserTaskBoard> {
        return serializedTransaction(UserChecklistTemplate.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            const settings = await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            const row = await UserChecklistTemplate.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) throw new PersonalError('missing');
            if (row.version !== version) throw new PersonalError('stale');
            const timezone = settings?.timezone?.trim() || 'UTC';
            if (input.timezone !== undefined && input.timezone !== timezone) throw new PersonalError('stale');
            let dueAt: number | null = null;
            if (input.due?.trim()) {
                if (input.exact && !/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?$/.test(input.due.trim())) throw new PersonalError('invalid');
                const parsed = parseReminderTime(input.due, timezone, this.now());
                if (!parsed) throw new PersonalError('invalid');
                dueAt = parsed.timestamp;
            }
            const template = board(row);
            return tasks.create({ userId, title: template.title, checklist: template.items, dueAt, timezone }, transaction);
        });
    }
}
