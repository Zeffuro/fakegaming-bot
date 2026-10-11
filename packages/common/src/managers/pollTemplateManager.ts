import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { PollTemplate } from '../models/poll-template.js';
import { PollSession } from '../models/poll-session.js';
import { UserConfig } from '../models/user-config.js';
import { serializedTransaction } from './serializedTransaction.js';
import { PersonalError, requirePersonalText } from './productivityShared.js';
import type { CreatePollInput, PollBoard, PollManager } from './pollManager.js';

export interface PollTemplateInput {
    title: string; question: string; options: readonly string[]; durationMinutes: number;
    allowMultiple?: boolean; hideResults?: boolean; ranked?: boolean;
}
export interface SavedPollTemplate extends Omit<PollTemplateInput, 'options' | 'allowMultiple' | 'hideResults' | 'ranked'> {
    id: string; options: string[]; allowMultiple: boolean; hideResults: boolean; ranked: boolean; version: number;
}
function values(input: PollTemplateInput) {
    const question = requirePersonalText(input.question, 200);
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 5) throw new PersonalError('invalid');
    const options = input.options.map(option => requirePersonalText(option, 200));
    if (new Set(options.map(option => option.normalize('NFKC').toLowerCase())).size !== options.length
        || !Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440
        || (input.allowMultiple !== undefined && typeof input.allowMultiple !== 'boolean')
        || (input.hideResults !== undefined && typeof input.hideResults !== 'boolean')
        || (input.ranked !== undefined && typeof input.ranked !== 'boolean') || (input.ranked && input.allowMultiple)) throw new PersonalError('invalid');
    return { title: requirePersonalText(input.title), question, optionsJson: JSON.stringify(options),
        durationMinutes: input.durationMinutes, allowMultiple: input.allowMultiple ?? false, hideResults: input.hideResults ?? false, ranked: input.ranked ?? false };
}
function board(row: PollTemplate): SavedPollTemplate {
    const options: unknown = JSON.parse(row.optionsJson);
    if (!Array.isArray(options) || !options.every(item => typeof item === 'string')) throw new Error('Invalid persisted poll template');
    return { id: row.id, title: row.title, question: row.question, options, durationMinutes: row.durationMinutes,
        allowMultiple: row.allowMultiple, hideResults: row.hideResults, ranked: row.ranked ?? false, version: row.version };
}
export class PollTemplateManager {
    async list(userId: string): Promise<SavedPollTemplate[]> {
        return (await PollTemplate.findAll({ where: { userId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] })).map(board);
    }
    async get(id: string, userId: string): Promise<SavedPollTemplate | null> {
        const row = await PollTemplate.findOne({ where: { id, userId } }); return row ? board(row) : null;
    }
    async create(userId: string, input: PollTemplateInput): Promise<SavedPollTemplate> {
        if (!userId) throw new PersonalError('invalid');
        const data = values(input);
        return serializedTransaction(PollTemplate.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            if (await PollTemplate.count({ where: { userId }, transaction }) >= 50) throw new PersonalError('capacity');
            return board(await PollTemplate.create({ id: randomUUID(), userId, ...data, version: 0 }, { transaction }));
        });
    }
    async savePoll(userId: string, pollId: string, title: string): Promise<SavedPollTemplate> {
        const poll = await PollSession.findOne({ where: { [Op.or]: [{ id: pollId }, { messageId: pollId }], creatorId: userId } });
        if (!poll) throw new PersonalError('missing');
        return this.create(userId, { title, question: poll.question, options: JSON.parse(poll.optionsJson) as string[],
            durationMinutes: poll.durationMinutes ?? Math.round((Number(poll.expiresAt) - new Date(poll.createdAt as Date).getTime()) / 60_000),
            allowMultiple: poll.allowMultiple, hideResults: poll.hideResults ?? false, ranked: poll.ranked ?? false });
    }
    async edit(id: string, userId: string, version: number, input: PollTemplateInput): Promise<SavedPollTemplate> {
        const data = values(input);
        return serializedTransaction(PollTemplate.sequelize!, async transaction => {
            const row = await PollTemplate.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) throw new PersonalError('missing');
            if (row.version !== version) throw new PersonalError('stale');
            return board(await row.update({ ...data, version: row.version + 1 }, { transaction }));
        });
    }
    async remove(id: string, userId: string, version: number): Promise<void> {
        return serializedTransaction(PollTemplate.sequelize!, async transaction => {
            const row = await PollTemplate.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) throw new PersonalError('missing');
            if (row.version !== version) throw new PersonalError('stale');
            await row.destroy({ transaction });
        });
    }
    async start(id: string, userId: string, version: number, polls: Pick<PollManager, 'create'>,
        scope: Pick<CreatePollInput, 'guildId' | 'channelId' | 'messageId' | 'locale'>): Promise<PollBoard> {
        return serializedTransaction(PollTemplate.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            const row = await PollTemplate.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!row) throw new PersonalError('missing');
            if (row.version !== version) throw new PersonalError('stale');
            const saved = board(row);
            return polls.create({ ...scope, creatorId: userId, question: saved.question, options: [...saved.options],
                durationMinutes: saved.durationMinutes, allowMultiple: saved.allowMultiple, hideResults: saved.hideResults, ranked: saved.ranked }, transaction);
        });
    }
}
