import { randomInt, randomUUID } from 'node:crypto';
import { Op, UniqueConstraintError } from 'sequelize';
import { GameNightNomination } from '../models/game-night-nomination.js';
import {
    GameNightSession,
    type GameNightKind,
    type GameNightState,
} from '../models/game-night-session.js';
import { GameNightVote } from '../models/game-night-vote.js';

export type { GameNightKind } from '../models/game-night-session.js';

export const GAME_NIGHT_MAX_NOMINATIONS = 5;
export const GAME_NIGHT_MIN_NOMINATIONS = 2;
export const GAME_NIGHT_DEFAULT_DURATION_HOURS = 6;
export const GAME_NIGHT_MIN_DURATION_HOURS = 1;
export const GAME_NIGHT_MAX_DURATION_HOURS = 24;
export const GAME_NIGHT_MAX_NAME_LENGTH = 80;

export type GameNightErrorCode =
    | 'active-session-exists'
    | 'duplicate-nomination'
    | 'expired'
    | 'invalid-duration'
    | 'invalid-kind'
    | 'invalid-name'
    | 'nomination-limit'
    | 'not-creator'
    | 'not-found'
    | 'not-nominating'
    | 'not-voting'
    | 'own-nomination-exists'
    | 'too-few-nominations'
    | 'wrong-channel';

export class GameNightError extends Error {
    constructor(public readonly code: GameNightErrorCode) {
        super(code);
        this.name = 'GameNightError';
    }
}

export interface GameNightBoard {
    session: {
        id: string;
        guildId: string;
        channelId: string;
        messageId: string | null;
        creatorId: string;
        name: string;
        kind: GameNightKind;
        allowMultipleNominations: boolean;
        state: GameNightState;
        expiresAt: number;
        winnerNominationId: string | null;
        tieBreakCandidateIds: string[];
        tieBreakIndex: number | null;
    };
    nominations: Array<{
        id: string;
        userId: string;
        gameName: string;
        voteCount: number;
    }>;
}

export interface GameNightManagerOptions {
    createId?: () => string;
    now?: () => number;
    pickTieIndex?: (candidateCount: number) => number;
}

export class GameNightManager {
    private readonly createId: () => string;
    private readonly now: () => number;
    private readonly pickTieIndex: (candidateCount: number) => number;
    private readonly pending = new Map<string, Promise<void>>();

    constructor(options: GameNightManagerOptions = {}) {
        this.createId = options.createId ?? randomUUID;
        this.now = options.now ?? Date.now;
        this.pickTieIndex = options.pickTieIndex ?? (count => randomInt(count));
    }

    async start(input: {
        guildId: string;
        channelId: string;
        creatorId: string;
        name: string;
        kind?: GameNightKind;
        allowMultipleNominations?: boolean;
        durationHours?: number;
    }): Promise<GameNightBoard> {
        return this.withLock('game-night', async () => {
            await this.expireGuildIfDue(input.guildId);
            const existing = await GameNightSession.findOne({ where: { activeKey: input.guildId } });
            if (existing) throw new GameNightError('active-session-exists');

            const name = normalizeGameNightName(input.name);
            if (!name || name.length > GAME_NIGHT_MAX_NAME_LENGTH) throw new GameNightError('invalid-name');
            const kind = input.kind ?? 'game';
            if (!isGameNightKind(kind)) throw new GameNightError('invalid-kind');
            const durationHours = input.durationHours ?? GAME_NIGHT_DEFAULT_DURATION_HOURS;
            if (durationHours < GAME_NIGHT_MIN_DURATION_HOURS || durationHours > GAME_NIGHT_MAX_DURATION_HOURS) {
                throw new GameNightError('invalid-duration');
            }

            const session = await GameNightSession.create({
                id: this.createId(),
                guildId: input.guildId,
                channelId: input.channelId,
                messageId: null,
                creatorId: input.creatorId,
                name,
                kind,
                allowMultipleNominations: input.allowMultipleNominations ?? false,
                state: 'nominating',
                activeKey: input.guildId,
                expiresAt: this.now() + durationHours * 60 * 60 * 1_000,
                winnerNominationId: null,
                tieBreakCandidateIds: null,
                tieBreakIndex: null,
                version: 0,
            });
            return this.loadBoard(session.id);
        });
    }

    async attachMessage(sessionId: string, messageId: string): Promise<void> {
        const [updated] = await GameNightSession.update({ messageId }, { where: { id: sessionId } });
        if (updated !== 1) throw new GameNightError('not-found');
    }

    async getActive(guildId: string): Promise<GameNightBoard | null> {
        await this.expireGuildIfDue(guildId);
        const session = await GameNightSession.findOne({ where: { activeKey: guildId } });
        return session ? this.loadBoard(session.id) : null;
    }

    async getById(sessionId: string): Promise<GameNightBoard | null> {
        const session = await GameNightSession.findByPk(sessionId);
        if (!session) return null;
        if (session.activeKey && Number(session.expiresAt) <= this.now()) await this.expire(session.id);
        return this.loadBoard(sessionId);
    }

    async listActive(): Promise<GameNightBoard[]> {
        const sessions = await GameNightSession.findAll({ where: { activeKey: { [Op.ne]: null } } });
        const boards: GameNightBoard[] = [];
        for (const session of sessions) {
            if (Number(session.expiresAt) <= this.now()) await this.expire(session.id);
            boards.push(await this.loadBoard(session.id));
        }
        return boards;
    }

    async nominate(input: {
        guildId: string;
        channelId: string;
        userId: string;
        gameName: string;
        canManageNominations?: boolean;
    }): Promise<GameNightBoard> {
        return this.withLock('game-night', async () => {
            const board = await this.requireActive(input.guildId, input.channelId);
            if (board.session.state !== 'nominating') throw new GameNightError('not-nominating');
            if (board.nominations.length >= GAME_NIGHT_MAX_NOMINATIONS) throw new GameNightError('nomination-limit');
            const canNominateMultiple = board.session.allowMultipleNominations || input.canManageNominations === true;
            if (!canNominateMultiple && board.nominations.some(item => item.userId === input.userId)) {
                throw new GameNightError('own-nomination-exists');
            }

            const gameName = normalizeGameNightName(input.gameName);
            if (!gameName || gameName.length > GAME_NIGHT_MAX_NAME_LENGTH) throw new GameNightError('invalid-name');
            const normalizedName = normalizeGameNightKey(gameName);
            if (board.nominations.some(item => normalizeGameNightKey(item.gameName) === normalizedName)) {
                throw new GameNightError('duplicate-nomination');
            }

            try {
                await GameNightNomination.create({
                    id: this.createId(),
                    sessionId: board.session.id,
                    userId: input.userId,
                    gameName,
                    normalizedName,
                });
            } catch (error) {
                if (error instanceof UniqueConstraintError) throw new GameNightError('duplicate-nomination');
                throw error;
            }
            return this.loadBoard(board.session.id);
        });
    }

    async openVoting(sessionId: string, actorId: string, canManage = false): Promise<GameNightBoard> {
        return this.withLock('game-night', async () => {
            const board = await this.requireBoard(sessionId);
            this.requireController(board, actorId, canManage);
            if (board.session.state !== 'nominating') throw new GameNightError('not-nominating');
            if (board.nominations.length < GAME_NIGHT_MIN_NOMINATIONS) throw new GameNightError('too-few-nominations');
            await this.transition(board, 'nominating', { state: 'voting' });
            return this.loadBoard(sessionId);
        });
    }

    async vote(sessionId: string, userId: string, nominationId: string): Promise<GameNightBoard> {
        return this.withLock('game-night', async () => {
            const board = await this.requireBoard(sessionId);
            if (board.session.state === 'expired') throw new GameNightError('expired');
            if (board.session.state !== 'voting') throw new GameNightError('not-voting');
            if (!board.nominations.some(item => item.id === nominationId)) throw new GameNightError('not-found');

            const existing = await GameNightVote.findOne({ where: { sessionId, userId } });
            if (existing) await existing.update({ nominationId });
            else await GameNightVote.create({ sessionId, userId, nominationId });
            return this.loadBoard(sessionId);
        });
    }

    async close(sessionId: string, actorId: string, canManage = false): Promise<GameNightBoard> {
        return this.withLock('game-night', async () => {
            const board = await this.requireBoard(sessionId);
            this.requireController(board, actorId, canManage);
            if (board.session.state === 'expired') throw new GameNightError('expired');
            if (board.session.state !== 'voting') throw new GameNightError('not-voting');

            const highest = Math.max(...board.nominations.map(item => item.voteCount));
            const candidates = board.nominations.filter(item => item.voteCount === highest);
            const tieBreakIndex = candidates.length > 1 ? this.validTieIndex(candidates.length) : null;
            const winner = candidates[tieBreakIndex ?? 0];
            if (!winner) throw new GameNightError('not-found');
            await this.transition(board, 'voting', {
                state: 'finished',
                activeKey: null,
                winnerNominationId: winner.id,
                tieBreakCandidateIds: candidates.length > 1 ? JSON.stringify(candidates.map(item => item.id)) : null,
                tieBreakIndex,
            });
            return this.loadBoard(sessionId);
        });
    }

    async expire(sessionId: string): Promise<GameNightBoard> {
        return this.withLock('game-night', async () => {
            const board = await this.requireBoard(sessionId);
            if (board.session.state === 'finished' || board.session.state === 'expired') return board;
            await this.transition(board, board.session.state, { state: 'expired', activeKey: null });
            return this.loadBoard(sessionId);
        });
    }

    private async requireActive(guildId: string, channelId: string): Promise<GameNightBoard> {
        await this.expireGuildIfDue(guildId);
        const session = await GameNightSession.findOne({ where: { activeKey: guildId } });
        if (!session) throw new GameNightError('not-found');
        if (session.channelId !== channelId) throw new GameNightError('wrong-channel');
        return this.loadBoard(session.id);
    }

    private async requireBoard(sessionId: string): Promise<GameNightBoard> {
        const session = await GameNightSession.findByPk(sessionId);
        if (!session) throw new GameNightError('not-found');
        if (session.activeKey && Number(session.expiresAt) <= this.now()) {
            await GameNightSession.update(
                { state: 'expired', activeKey: null, version: session.version + 1 },
                { where: { id: session.id, version: session.version } },
            );
        }
        return this.loadBoard(sessionId);
    }

    private requireController(board: GameNightBoard, actorId: string, canManage: boolean): void {
        if (board.session.creatorId !== actorId && !canManage) throw new GameNightError('not-creator');
    }

    private async transition(
        board: GameNightBoard,
        expectedState: GameNightState,
        values: Record<string, unknown>,
    ): Promise<void> {
        const current = await GameNightSession.findByPk(board.session.id);
        if (!current) throw new GameNightError('not-found');
        const [updated] = await GameNightSession.update(
            { ...values, version: current.version + 1 },
            { where: { id: current.id, state: expectedState, version: current.version } },
        );
        if (updated !== 1) throw new GameNightError(expectedState === 'voting' ? 'not-voting' : 'not-nominating');
    }

    private async expireGuildIfDue(guildId: string): Promise<void> {
        await GameNightSession.update(
            { state: 'expired', activeKey: null },
            { where: { activeKey: guildId, expiresAt: { [Op.lte]: this.now() } } },
        );
    }

    private async loadBoard(sessionId: string): Promise<GameNightBoard> {
        const session = await GameNightSession.findByPk(sessionId, { raw: true });
        if (!session) throw new GameNightError('not-found');
        const nominations = await GameNightNomination.findAll({
            where: { sessionId },
            order: [['createdAt', 'ASC'], ['id', 'ASC']],
            raw: true,
        });
        const votes = await GameNightVote.findAll({ where: { sessionId }, raw: true });
        const voteCounts = new Map<string, number>();
        for (const vote of votes) voteCounts.set(vote.nominationId, (voteCounts.get(vote.nominationId) ?? 0) + 1);
        return {
            session: {
                id: session.id,
                guildId: session.guildId,
                channelId: session.channelId,
                messageId: session.messageId ?? null,
                creatorId: session.creatorId,
                name: session.name,
                kind: isGameNightKind(session.kind) ? session.kind : 'game',
                allowMultipleNominations: Boolean(session.allowMultipleNominations),
                state: session.state,
                expiresAt: Number(session.expiresAt),
                winnerNominationId: session.winnerNominationId ?? null,
                tieBreakCandidateIds: parseTieCandidates(session.tieBreakCandidateIds),
                tieBreakIndex: session.tieBreakIndex ?? null,
            },
            nominations: nominations.map(item => ({
                id: item.id,
                userId: item.userId,
                gameName: item.gameName,
                voteCount: voteCounts.get(item.id) ?? 0,
            })),
        };
    }

    private validTieIndex(candidateCount: number): number {
        const index = this.pickTieIndex(candidateCount);
        if (!Number.isInteger(index) || index < 0 || index >= candidateCount) {
            throw new RangeError(`Tie picker returned invalid index ${index} for ${candidateCount} candidates.`);
        }
        return index;
    }

    private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
        const previous = this.pending.get(key) ?? Promise.resolve();
        let release: () => void = () => undefined;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const current = previous.then(() => gate);
        this.pending.set(key, current);
        await previous;
        try {
            return await operation();
        } finally {
            release();
            if (this.pending.get(key) === current) this.pending.delete(key);
        }
    }
}

export function normalizeGameNightName(value: string): string {
    const normalized = value
        .normalize('NFKC')
        .replace(/\p{Cc}+/gu, ' ')
        .trim()
        .replace(/\s+/gu, ' ');
    const visibleContent = normalized.replace(/[\p{C}\p{Z}]/gu, '');
    return visibleContent.length > 0 ? normalized : '';
}

export function normalizeGameNightKey(value: string): string {
    return normalizeGameNightName(value).toLocaleLowerCase('en-US');
}

export function isGameNightKind(value: unknown): value is GameNightKind {
    return value === 'game' || value === 'movie';
}

function parseTieCandidates(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : [];
    } catch {
        return [];
    }
}
