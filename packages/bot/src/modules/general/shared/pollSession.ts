import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

const MAX_ACTIVE_POLLS = 200;
const SESSION_RETENTION_MS = 60 * 60 * 1000;
const RENDER_DEBOUNCE_MS = 750;

export const POLL_MIN_DURATION_MINUTES = 1;
export const POLL_MAX_DURATION_MINUTES = 24 * 60;
export const POLL_DEFAULT_DURATION_MINUTES = 10;

export interface PollSessionMessage {
    edit: (options: PollMessagePayload) => Promise<unknown>;
}

export interface PollSession {
    id: string;
    creatorId: string;
    question: string;
    options: readonly string[];
    createdAt: number;
    expiresAt: number;
    votes: Map<string, number>;
    message: PollSessionMessage;
    closedAt: number | null;
    closeReason: 'creator' | 'expired' | null;
    renderTimer: ReturnType<typeof setTimeout> | null;
    expiryTimer: ReturnType<typeof setTimeout> | null;
    cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export interface PollMessagePayload {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
    allowedMentions: { parse: [] };
}

export interface PollSessionStoreOptions {
    now?: () => number;
    createId?: () => string;
    setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
    clearTimeout?: (timer: ReturnType<typeof setTimeout>) => void;
    maxActivePolls?: number;
    renderDebounceMs?: number;
    sessionRetentionMs?: number;
}

export interface CreatePollSessionInput {
    creatorId: string;
    question: string;
    options: readonly string[];
    durationMinutes: number;
    message: PollSessionMessage;
}

export interface PollVoteResult {
    status: 'recorded' | 'unchanged' | 'closed' | 'missing';
    session: PollSession | null;
}

export interface PollCloseResult {
    status: 'closed' | 'not-creator' | 'already-closed' | 'missing';
    session: PollSession | null;
}

export class PollSessionStore {
    private readonly sessions = new Map<string, PollSession>();
    private readonly now: () => number;
    private readonly createId: () => string;
    private readonly schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
    private readonly cancel: (timer: ReturnType<typeof setTimeout>) => void;
    private readonly maxActivePolls: number;
    private readonly renderDebounceMs: number;
    private readonly sessionRetentionMs: number;

    public constructor(options: PollSessionStoreOptions = {}) {
        this.now = options.now ?? Date.now;
        this.createId = options.createId ?? createPollId;
        this.schedule = options.setTimeout ?? setTimeout;
        this.cancel = options.clearTimeout ?? clearTimeout;
        this.maxActivePolls = options.maxActivePolls ?? MAX_ACTIVE_POLLS;
        this.renderDebounceMs = options.renderDebounceMs ?? RENDER_DEBOUNCE_MS;
        this.sessionRetentionMs = options.sessionRetentionMs ?? SESSION_RETENTION_MS;
    }

    public create(input: CreatePollSessionInput): PollSession | null {
        this.pruneExpired();
        if (this.activeSessionCount() >= this.maxActivePolls) return null;

        const createdAt = this.now();
        const expiresAt = createdAt + input.durationMinutes * 60_000;
        const session: PollSession = {
            id: this.nextId(),
            creatorId: input.creatorId,
            question: input.question,
            options: [...input.options],
            createdAt,
            expiresAt,
            votes: new Map(),
            message: input.message,
            closedAt: null,
            closeReason: null,
            renderTimer: null,
            expiryTimer: null,
            cleanupTimer: null,
        };

        session.expiryTimer = this.schedule(() => {
            void this.expire(session.id);
        }, Math.max(0, expiresAt - this.now()));
        this.sessions.set(session.id, session);
        return session;
    }

    public get(id: string): PollSession | null {
        const session = this.sessions.get(id) ?? null;
        if (session && session.closedAt === null && this.now() >= session.expiresAt) {
            void this.expire(id);
        }
        return session;
    }

    public vote(id: string, userId: string, optionIndex: number): PollVoteResult {
        const session = this.get(id);
        if (!session) return { status: 'missing', session: null };
        if (session.closedAt !== null) return { status: 'closed', session };
        if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= session.options.length) {
            return { status: 'missing', session: null };
        }

        const previous = session.votes.get(userId);
        if (previous === optionIndex) return { status: 'unchanged', session };

        session.votes.set(userId, optionIndex);
        this.scheduleRender(session);
        return { status: 'recorded', session };
    }

    public close(id: string, userId: string): PollCloseResult {
        const session = this.get(id);
        if (!session) return { status: 'missing', session: null };
        if (session.creatorId !== userId) return { status: 'not-creator', session };
        if (session.closedAt !== null) return { status: 'already-closed', session };

        this.markClosed(session, 'creator');
        return { status: 'closed', session };
    }

    public async renderNow(session: PollSession): Promise<void> {
        if (session.renderTimer !== null) {
            this.cancel(session.renderTimer);
            session.renderTimer = null;
        }
        await session.message.edit(renderPollMessage(session));
    }

    public clear(): void {
        for (const session of this.sessions.values()) this.remove(session);
    }

    private async expire(id: string): Promise<void> {
        const session = this.sessions.get(id);
        if (!session || session.closedAt !== null) return;

        this.markClosed(session, 'expired');
        try {
            await this.renderNow(session);
        } catch {
            // Interaction state remains closed even if Discord cannot edit the old message.
        }
    }

    private markClosed(session: PollSession, reason: 'creator' | 'expired'): void {
        session.closedAt = this.now();
        session.closeReason = reason;
        if (session.expiryTimer !== null) {
            this.cancel(session.expiryTimer);
            session.expiryTimer = null;
        }
        if (session.renderTimer !== null) {
            this.cancel(session.renderTimer);
            session.renderTimer = null;
        }
        session.cleanupTimer = this.schedule(() => this.remove(session), this.sessionRetentionMs);
    }

    private scheduleRender(session: PollSession): void {
        if (session.renderTimer !== null) return;
        session.renderTimer = this.schedule(() => {
            session.renderTimer = null;
            void this.renderNow(session).catch(() => undefined);
        }, this.renderDebounceMs);
    }

    private pruneExpired(): void {
        for (const session of this.sessions.values()) {
            if (session.closedAt === null && this.now() >= session.expiresAt) void this.expire(session.id);
        }
    }

    private activeSessionCount(): number {
        let count = 0;
        for (const session of this.sessions.values()) {
            if (session.closedAt === null) count += 1;
        }
        return count;
    }

    private nextId(): string {
        for (let attempts = 0; attempts < 10; attempts += 1) {
            const id = this.createId();
            if (!this.sessions.has(id)) return id;
        }
        throw new Error('Could not allocate a unique poll session ID.');
    }

    private remove(session: PollSession): void {
        if (this.sessions.get(session.id) !== session) return;
        if (session.renderTimer !== null) this.cancel(session.renderTimer);
        if (session.expiryTimer !== null) this.cancel(session.expiryTimer);
        if (session.cleanupTimer !== null) this.cancel(session.cleanupTimer);
        this.sessions.delete(session.id);
    }
}

export function renderPollMessage(session: PollSession): PollMessagePayload {
    const counts = optionCounts(session);
    const totalVotes = session.votes.size;
    const closed = session.closedAt !== null;
    const lines = [
        `**${session.question}**`,
        closed
            ? `Poll closed ${session.closeReason === 'expired' ? 'when its duration elapsed' : 'by its creator'}.`
            : `Closes <t:${Math.floor(session.expiresAt / 1_000)}:R>.`,
        '',
        ...session.options.map((option, index) => {
            const count = counts[index] ?? 0;
            const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
            return `${index + 1}. ${option} - ${count} vote${count === 1 ? '' : 's'} (${percentage}%)`;
        }),
        '',
        `Total votes: ${totalVotes}`,
    ];

    if (closed) lines.push(formatResult(session, counts));

    return {
        content: lines.join('\n'),
        components: pollComponents(session.id, session.options, closed),
        allowedMentions: { parse: [] },
    };
}

export function pollComponents(
    pollId: string,
    options: readonly string[],
    disabled: boolean,
): ActionRowBuilder<ButtonBuilder>[] {
    const optionButtons = options.map((option, index) => new ButtonBuilder()
        .setCustomId(`poll:vote:${pollId}:${index}`)
        .setLabel(`${index + 1}. ${truncateButtonLabel(option)}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled));
    const closeButton = new ButtonBuilder()
        .setCustomId(`poll:close:${pollId}`)
        .setLabel('Close poll')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(...optionButtons),
        new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton),
    ];
}

function optionCounts(session: PollSession): number[] {
    const counts = Array.from({ length: session.options.length }, () => 0);
    for (const optionIndex of session.votes.values()) {
        counts[optionIndex] = (counts[optionIndex] ?? 0) + 1;
    }
    return counts;
}

function formatResult(session: PollSession, counts: readonly number[]): string {
    const highestCount = Math.max(...counts);
    if (highestCount === 0) return 'Result: no votes were cast.';

    const winners = session.options.filter((_option, index) => counts[index] === highestCount);
    if (winners.length === 1) return `Winner: **${winners[0] ?? ''}** (${highestCount} vote${highestCount === 1 ? '' : 's'}).`;
    return `Result: tie between ${winners.map(winner => `**${winner}**`).join(', ')} (${highestCount} vote${highestCount === 1 ? '' : 's'} each).`;
}

function createPollId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function truncateButtonLabel(option: string): string {
    return option.length <= 72 ? option : `${option.slice(0, 69)}...`;
}
