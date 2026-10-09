import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { UserCountdown } from '../models/personal-productivity.js';
import { serializedTransaction } from './serializedTransaction.js';
import { createOwnedReminder, PersonalError, removeOwnedReminder, requirePersonalText, requirePersonalTime } from './productivityShared.js';

export interface UserCountdownBoard {
    id: string; userId: string; title: string; dueAt: number; timezone: string; advanceMinutes: number | null;
}

export class UserCountdownManager {
    constructor(private readonly now: () => number = Date.now) {}

    async create(input: {
        userId: string; title: string; dueAt: number; timezone: string; advanceMinutes?: number | null;
        dueMessage: string; advanceMessage: string;
    }): Promise<UserCountdownBoard> {
        const title = requirePersonalText(input.title);
        requirePersonalTime(input.dueAt, this.now());
        if (!input.userId) throw new PersonalError('invalid');
        try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { throw new PersonalError('invalid'); }
        const advance = input.advanceMinutes ?? null;
        if (advance !== null && (!Number.isInteger(advance) || advance < 1 || advance > 525_600 || input.dueAt - advance * 60_000 <= this.now())) {
            throw new PersonalError('invalid');
        }
        return serializedTransaction(UserCountdown.sequelize!, async transaction => {
            await UserCountdown.destroy({ where: { userId: input.userId, dueAt: { [Op.lt]: this.now() - 90 * 86_400_000 } }, transaction });
            if (await UserCountdown.count({ where: { userId: input.userId }, transaction }) >= 100) throw new PersonalError('capacity');
            const id = randomUUID();
            const reminderIds = [`countdown:${id}:due`];
            await createOwnedReminder(reminderIds[0]!, input.userId, requirePersonalText(input.dueMessage, 1_800), input.dueAt, this.now(), transaction);
            if (advance !== null) {
                const reminderId = `countdown:${id}:advance`;
                reminderIds.push(reminderId);
                await createOwnedReminder(reminderId, input.userId, requirePersonalText(input.advanceMessage, 1_800), input.dueAt - advance * 60_000, this.now(), transaction);
            }
            const row = await UserCountdown.create({ id, userId: input.userId, title, dueAt: input.dueAt, timezone: input.timezone, advanceMinutes: advance, reminderIdsJson: JSON.stringify(reminderIds) }, { transaction });
            return this.board(row);
        });
    }

    async list(userId: string): Promise<UserCountdownBoard[]> {
        const rows = await UserCountdown.findAll({ where: { userId, dueAt: { [Op.gt]: this.now() } }, order: [['dueAt', 'ASC'], ['id', 'ASC']] });
        return rows.map(row => this.board(row));
    }

    async get(id: string, userId: string): Promise<UserCountdownBoard | null> {
        const row = await UserCountdown.findOne({ where: { id, userId } });
        return row ? this.board(row) : null;
    }

    async remove(id: string, userId: string): Promise<boolean> {
        return serializedTransaction(UserCountdown.sequelize!, async transaction => {
            const row = await UserCountdown.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) return false;
            const ids: unknown = JSON.parse(row.reminderIdsJson);
            if (!Array.isArray(ids) || !ids.every(item => typeof item === 'string')) throw new Error('Invalid persisted countdown reminders');
            for (const reminderId of ids) await removeOwnedReminder(reminderId, userId, transaction);
            await row.destroy({ transaction });
            return true;
        });
    }

    async forReminder(reminderId: string, userId: string): Promise<UserCountdownBoard | null> {
        const [, id, kind] = reminderId.split(':');
        if (!id || (kind !== 'due' && kind !== 'advance')) return null;
        const row = await UserCountdown.findOne({ where: { id, userId } });
        if (!row) return null;
        const ids: unknown = JSON.parse(row.reminderIdsJson);
        return Array.isArray(ids) && ids.includes(reminderId) ? this.board(row) : null;
    }

    private board(row: UserCountdown): UserCountdownBoard {
        return { id: row.id, userId: row.userId, title: row.title, dueAt: Number(row.dueAt), timezone: row.timezone, advanceMinutes: row.advanceMinutes };
    }
}
