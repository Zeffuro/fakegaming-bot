import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { PollSession, type PollCloseReason } from '../models/poll-session.js';
import { DEFAULT_OUTPUT_LOCALE, isSupportedLocale, type SupportedLocale } from '../utils/outputLocale.js';

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
    locale?: SupportedLocale;
}

export class PollManager {
    private pending: Promise<unknown> = Promise.resolve();
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

    async create(input: CreatePollInput): Promise<PollBoard> {
        return this.withLock(async () => {
            await this.expireDue();
            await this.prune();
            const duration = input.durationMinutes ?? POLL_DEFAULT_DURATION_MINUTES;
            const question = input.question.trim();
            const options = input.options.map(option => option.trim());
            if (!input.guildId || !input.channelId || !input.messageId || !input.creatorId || !question
                || question.length > 200 || options.length < 2 || options.length > 5
                || options.some(option => !option || option.length > 200)
                || new Set(options.map(option => option.normalize('NFKC').toLowerCase())).size !== options.length
                || !Number.isInteger(duration) || duration < POLL_MIN_DURATION_MINUTES || duration > POLL_MAX_DURATION_MINUTES) {
                throw new PollError('invalid-input');
            }
            if (await PollSession.count({ where: { closedAt: null } }) >= this.maxActive) throw new PollError('capacity');
            const session = await PollSession.create({
                id: this.createId(), guildId: input.guildId, channelId: input.channelId, messageId: input.messageId,
                creatorId: input.creatorId, question, optionsJson: JSON.stringify(options), votesJson: '[]',
                allowMultiple: input.allowMultiple ?? false, locale: input.locale ?? DEFAULT_OUTPUT_LOCALE,
                expiresAt: this.now() + duration * 60_000, closedAt: null, closeReason: null, renderPending: true, version: 0,
            });
            return this.toBoard(session);
        });
    }

    async get(id: string, scope?: PollScope): Promise<PollBoard | null> {
        return this.withLock(async () => {
            const session = await PollSession.findOne({ where: { id, ...scope } });
            if (!session) return null;
            await this.expireSession(session);
            return this.toBoard(session);
        });
    }

    async vote(id: string, scope: PollScope, userId: string, optionIndex: number): Promise<PollBoard> {
        return this.withLock(async () => {
            const session = await this.require(id, scope);
            await this.expireSession(session);
            if (session.closedAt !== null) throw new PollError('closed');
            const board = this.toBoard(session);
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
                await session.update({ votesJson: JSON.stringify([...board.votes]), version: session.version + 1, renderPending: true });
            }
            return this.toBoard(session);
        });
    }

    async close(id: string, scope: PollScope, userId: string, canManage = false): Promise<PollBoard> {
        return this.withLock(async () => {
            const session = await this.require(id, scope);
            if (session.creatorId !== userId && !canManage) throw new PollError('not-authorized');
            await this.expireSession(session);
            if (session.closedAt !== null) throw new PollError('closed');
            await this.finish(session, session.creatorId === userId ? 'creator' : 'moderator');
            return this.toBoard(session);
        });
    }

    async listForRecovery(): Promise<PollBoard[]> {
        return this.withLock(async () => {
            await this.expireDue();
            await this.prune();
            const sessions = await PollSession.findAll({
                where: { [Op.or]: [{ closedAt: null }, { renderPending: true }] }, order: [['createdAt', 'ASC']],
            });
            return sessions.map(session => this.toBoard(session));
        });
    }

    async markRendered(id: string, version: number): Promise<void> {
        await this.withLock(async () => {
            await PollSession.update({ renderPending: false }, { where: { id, version } });
        });
    }

    private async require(id: string, scope: PollScope): Promise<PollSession> {
        const session = await PollSession.findOne({ where: { id, ...scope } });
        if (!session) throw new PollError('missing');
        return session;
    }

    private async expireSession(session: PollSession): Promise<void> {
        if (session.closedAt === null && Number(session.expiresAt) <= this.now()) await this.finish(session, 'expired');
    }

    private async finish(session: PollSession, reason: PollCloseReason): Promise<void> {
        await session.update({
            closedAt: reason === 'expired' ? Number(session.expiresAt) : this.now(),
            closeReason: reason, renderPending: true, version: session.version + 1,
        });
    }

    private async expireDue(): Promise<void> {
        const sessions = await PollSession.findAll({ where: { closedAt: null, expiresAt: { [Op.lte]: this.now() } } });
        for (const session of sessions) await this.finish(session, 'expired');
    }

    private async prune(): Promise<void> {
        await PollSession.destroy({ where: { closedAt: { [Op.lt]: this.now() - this.retentionMs } } });
        const finished = await PollSession.findAll({
            where: { closedAt: { [Op.ne]: null } }, order: [['closedAt', 'DESC'], ['id', 'ASC']],
        });
        const counts = new Map<string, number>();
        const excess: string[] = [];
        for (const session of finished) {
            const count = (counts.get(session.guildId) ?? 0) + 1;
            counts.set(session.guildId, count);
            if (count > this.maxFinished) excess.push(session.id);
        }
        if (excess.length > 0) await PollSession.destroy({ where: { id: { [Op.in]: excess } } });
    }

    private toBoard(session: PollSession): PollBoard {
        const options: unknown = JSON.parse(session.optionsJson);
        const votes: unknown = JSON.parse(session.votesJson);
        if (!Array.isArray(options) || !options.every(option => typeof option === 'string') || options.length < 2 || options.length > 5
            || !Array.isArray(votes) || !votes.every(vote => Array.isArray(vote) && vote.length === 2 && typeof vote[0] === 'string'
                && Array.isArray(vote[1]) && vote[1].every(index => Number.isInteger(index) && index >= 0 && index < options.length)
                && new Set(vote[1]).size === vote[1].length)) {
            throw new Error(`Invalid persisted poll ${session.id}`);
        }
        return {
            id: session.id, guildId: session.guildId, channelId: session.channelId, messageId: session.messageId,
            creatorId: session.creatorId, question: session.question, options: options as string[],
            votes: new Map(votes as Array<[string, number[]]>), allowMultiple: session.allowMultiple,
            locale: isSupportedLocale(session.locale) ? session.locale : DEFAULT_OUTPUT_LOCALE, expiresAt: Number(session.expiresAt),
            closedAt: session.closedAt === null ? null : Number(session.closedAt), closeReason: session.closeReason,
            renderPending: session.renderPending, version: session.version,
        };
    }

    private withLock<T>(action: () => Promise<T>): Promise<T> {
        // A singleton serializes aggregate read/write operations, including SQLite recovery.
        const result = this.pending.then(action, action);
        this.pending = result.catch(() => undefined);
        return result;
    }
}
