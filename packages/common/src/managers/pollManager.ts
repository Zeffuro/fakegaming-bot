import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { PollSession, type PollCloseReason } from '../models/poll-session.js';
import { DEFAULT_OUTPUT_LOCALE, isSupportedLocale, type SupportedLocale } from '../utils/outputLocale.js';
import { validRanking } from './rankedPoll.js';
import { serializedTransaction } from './serializedTransaction.js';
export { countRankedPoll, validRanking, type RankedPollResult, type RankedPollRound } from './rankedPoll.js';

export const POLL_MIN_DURATION_MINUTES = 1;
export const POLL_MAX_DURATION_MINUTES = 24 * 60;
export const POLL_DEFAULT_DURATION_MINUTES = 10;
export const POLL_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;

export interface PollScope {
    guildId: string;
    channelId: string;
    messageId: string;
}

export interface PollBoard extends PollScope {
    id: string;
    creatorId: string;
    question: string;
    options: string[];
    votes: Map<string, number[]>;
    allowMultiple: boolean;
    hideResults: boolean;
    ranked: boolean;
    locale: SupportedLocale;
    expiresAt: number;
    closedAt: number | null;
    closeReason: PollCloseReason | null;
    renderPending: boolean;
    version: number;
}

export type PollErrorCode = 'capacity' | 'invalid-input' | 'missing' | 'closed' | 'not-authorized';

export class PollError extends Error {
    constructor(public readonly code: PollErrorCode) {
        super(code);
        this.name = 'PollError';
    }
}

export interface CreatePollInput extends PollScope {
    creatorId: string;
    question: string;
    options: readonly string[];
    durationMinutes?: number;
    allowMultiple?: boolean;
    hideResults?: boolean;
    ranked?: boolean;
    locale?: SupportedLocale;
}

export class PollManager {
    private readonly now: () => number;
    private readonly createId: () => string;
    private readonly maxActive: number;
    private readonly maxFinished: number;
    private readonly retentionMs: number;

    constructor(options: {
        now?: () => number; createId?: () => string; maxActive?: number; maxFinished?: number; retentionMs?: number;
    } = {}) {
        this.now = options.now ?? Date.now;
        this.createId = options.createId ?? randomUUID;
        this.maxActive = options.maxActive ?? 200;
        this.maxFinished = options.maxFinished ?? 1_000;
        this.retentionMs = options.retentionMs ?? POLL_RETENTION_MS;
    }

    async create(input: CreatePollInput, transaction?: Transaction): Promise<PollBoard> {
        return this.withTransaction(async transaction => {
            await this.expireDue(transaction);
            await this.prune(transaction);
            const duration = input.durationMinutes ?? POLL_DEFAULT_DURATION_MINUTES;
            const question = input.question.trim();
            const options = input.options.map(option => option.trim());
            if (!input.guildId || !input.channelId || !input.messageId || !input.creatorId || !question
                || question.length > 200 || options.length < 2 || options.length > 5
                || options.some(option => !option || option.length > 200)
                || new Set(options.map(option => option.normalize('NFKC').toLowerCase())).size !== options.length
                || !Number.isInteger(duration) || duration < POLL_MIN_DURATION_MINUTES || duration > POLL_MAX_DURATION_MINUTES
                || (input.ranked !== undefined && typeof input.ranked !== 'boolean') || (input.ranked && input.allowMultiple)) {
                throw new PollError('invalid-input');
            }
            if (await PollSession.count({ where: { closedAt: null }, transaction }) >= this.maxActive) throw new PollError('capacity');
            const session = await PollSession.create({
                id: this.createId(), guildId: input.guildId, channelId: input.channelId, messageId: input.messageId,
                creatorId: input.creatorId, question, optionsJson: JSON.stringify(options), votesJson: '[]',
                allowMultiple: input.allowMultiple ?? false, hideResults: input.hideResults ?? false,
                ranked: input.ranked ?? false,
                locale: input.locale ?? DEFAULT_OUTPUT_LOCALE,
                durationMinutes: duration, expiresAt: this.now() + duration * 60_000, closedAt: null, closeReason: null, renderPending: true, version: 0,
            }, { transaction });
            return this.toBoard(session);
        }, transaction);
    }

    async get(id: string, scope?: PollScope): Promise<PollBoard | null> {
        return this.withTransaction(async transaction => {
            const session = await PollSession.findOne({ where: { id, ...scope }, transaction, lock: transaction.LOCK.UPDATE });
            if (!session) return null;
            await this.expireSession(session, transaction);
            return this.toBoard(session);
        });
    }

    async vote(id: string, scope: PollScope, userId: string, optionIndex: number): Promise<PollBoard> {
        return this.withOpenPoll(id, scope, async (session, transaction) => {
            const board = this.toBoard(session);
            if (board.ranked) throw new PollError('invalid-input');
            if (!userId || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= board.options.length) {
                throw new PollError('missing');
            }
            const previous = board.votes.get(userId) ?? [];
            const next = board.allowMultiple
                ? previous.includes(optionIndex) ? previous.filter(index => index !== optionIndex) : [...previous, optionIndex].sort((a, b) => a - b)
                : [optionIndex];
            if (next.length === 0) board.votes.delete(userId);
            else board.votes.set(userId, next);
            if (JSON.stringify(next) !== JSON.stringify(previous)) {
                await session.update({ votesJson: JSON.stringify([...board.votes]), version: session.version + 1, renderPending: true }, { transaction });
            }
            return this.toBoard(session);
        });
    }

    async rank(id: string, scope: PollScope, userId: string, ranking: readonly number[]): Promise<PollBoard> {
        return this.withOpenPoll(id, scope, async (session, transaction) => {
            const board = this.toBoard(session);
            if (!board.ranked || !userId || !validRanking(ranking, board.options.length)) throw new PollError('invalid-input');
            const previous = board.votes.get(userId) ?? [];
            if (JSON.stringify(previous) !== JSON.stringify(ranking)) {
                board.votes.set(userId, [...ranking]);
                await session.update({ votesJson: JSON.stringify([...board.votes]), version: session.version + 1, renderPending: true }, { transaction });
            }
            return this.toBoard(session);
        });
    }

    async close(id: string, scope: PollScope, userId: string, canManage = false): Promise<PollBoard> {
        return this.withOpenPoll(id, scope, async (session, transaction) => {
            if (session.creatorId !== userId && !canManage) throw new PollError('not-authorized');
            await this.finish(session, session.creatorId === userId ? 'creator' : 'moderator', transaction);
            return this.toBoard(session);
        });
    }

    async listForRecovery(): Promise<PollBoard[]> {
        return this.withTransaction(async transaction => {
            await this.expireDue(transaction);
            await this.prune(transaction);
            const sessions = await PollSession.findAll({
                where: { [Op.or]: [{ closedAt: null }, { renderPending: true }] }, order: [['createdAt', 'ASC']], transaction,
            });
            return sessions.map(session => this.toBoard(session));
        });
    }

    async markRendered(id: string, version: number): Promise<void> {
        await this.withTransaction(async transaction => {
            await PollSession.update({ renderPending: false }, { where: { id, version }, transaction });
        });
    }

    private async require(id: string, scope: PollScope, transaction: Transaction): Promise<PollSession> {
        const session = await PollSession.findOne({ where: { id, ...scope }, transaction, lock: transaction.LOCK.UPDATE });
        if (!session) throw new PollError('missing');
        return session;
    }

    private async expireSession(session: PollSession, transaction: Transaction): Promise<void> {
        if (session.closedAt === null && Number(session.expiresAt) <= this.now()) await this.finish(session, 'expired', transaction);
    }

    private async finish(session: PollSession, reason: PollCloseReason, transaction: Transaction): Promise<void> {
        await session.update({
            closedAt: reason === 'expired' ? Number(session.expiresAt) : this.now(),
            closeReason: reason, renderPending: true, version: session.version + 1,
        }, { transaction });
    }

    private async expireDue(transaction: Transaction): Promise<void> {
        const sessions = await PollSession.findAll({ where: { closedAt: null, expiresAt: { [Op.lte]: this.now() } }, transaction, lock: transaction.LOCK.UPDATE });
        for (const session of sessions) await this.finish(session, 'expired', transaction);
    }

    private async prune(transaction: Transaction): Promise<void> {
        await PollSession.destroy({ where: { closedAt: { [Op.lt]: this.now() - this.retentionMs } }, transaction });
        const finished = await PollSession.findAll({
            where: { closedAt: { [Op.ne]: null } }, order: [['closedAt', 'DESC'], ['id', 'ASC']], transaction,
        });
        const counts = new Map<string, number>();
        const excess: string[] = [];
        for (const session of finished) {
            const count = (counts.get(session.guildId) ?? 0) + 1;
            counts.set(session.guildId, count);
            if (count > this.maxFinished) excess.push(session.id);
        }
        if (excess.length > 0) await PollSession.destroy({ where: { id: { [Op.in]: excess } }, transaction });
    }

    private toBoard(session: PollSession): PollBoard {
        const options: unknown = JSON.parse(session.optionsJson);
        const votes: unknown = JSON.parse(session.votesJson);
        if ((session.ranked && session.allowMultiple) || !Array.isArray(options) || !options.every(option => typeof option === 'string') || options.length < 2 || options.length > 5
            || !Array.isArray(votes) || !votes.every(vote => Array.isArray(vote) && vote.length === 2 && typeof vote[0] === 'string'
                && Array.isArray(vote[1]) && vote[1].every(index => Number.isInteger(index) && index >= 0 && index < options.length)
                && new Set(vote[1]).size === vote[1].length && (!session.ranked || vote[1].length > 0))) {
            throw new Error(`Invalid persisted poll ${session.id}`);
        }
        return {
            id: session.id, guildId: session.guildId, channelId: session.channelId, messageId: session.messageId,
            creatorId: session.creatorId, question: session.question, options: options as string[],
            votes: new Map(votes as Array<[string, number[]]>), allowMultiple: session.allowMultiple,
            hideResults: session.hideResults ?? false,
            ranked: session.ranked ?? false,
            locale: isSupportedLocale(session.locale) ? session.locale : DEFAULT_OUTPUT_LOCALE, expiresAt: Number(session.expiresAt),
            closedAt: session.closedAt === null ? null : Number(session.closedAt), closeReason: session.closeReason,
            renderPending: session.renderPending, version: session.version,
        };
    }

    private async withOpenPoll(id: string, scope: PollScope,
        action: (session: PollSession, transaction: Transaction) => Promise<PollBoard>): Promise<PollBoard> {
        const result = await this.withTransaction(async transaction => {
            const session = await this.require(id, scope, transaction);
            await this.expireSession(session, transaction);
            if (session.closedAt !== null) return new PollError('closed');
            return action(session, transaction);
        });
        // Commit expiry before returning a rejected ballot submission.
        if (result instanceof PollError) throw result;
        return result;
    }

    private withTransaction<T>(action: (transaction: Transaction) => Promise<T>, transaction?: Transaction): Promise<T> {
        return transaction ? action(transaction) : serializedTransaction(PollSession.sequelize!, action);
    }
}
