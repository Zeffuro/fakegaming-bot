import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager, type PollBoard, type PollManager } from '@zeffuro/fakegaming-common/managers';
import type { Client } from 'discord.js';
import { renderPollMessage } from './pollSession.js';

const log = getLogger({ name: 'bot:polls' });

export type PollPersistence = Pick<PollManager, 'create' | 'get' | 'vote' | 'close' | 'listForRecovery' | 'markRendered'>;

export class PollRuntime {
    private readonly refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly rendering = new Map<string, Promise<void>>();
    private sweepTimer: ReturnType<typeof setInterval> | null = null;
    private sweeping = false;
    private stopped = false;

    constructor(
        readonly manager: PollPersistence,
        private readonly edit: (board: PollBoard) => Promise<void>,
        private readonly options: { now?: () => number; debounceMs?: number; sweepMs?: number } = {},
    ) {}

    async start(): Promise<void> {
        this.stopped = false;
        if (this.sweepTimer) clearInterval(this.sweepTimer);
        this.sweepTimer = setInterval(() => {
            void this.sweep().catch(error => log.warn({ err: error }, 'Poll recovery failed'));
        }, this.options.sweepMs ?? 30_000);
        this.sweepTimer.unref();
        await this.sweep();
    }

    track(board: PollBoard, immediate = false): void {
        if (this.stopped) return;
        const existing = this.expiryTimers.get(board.id);
        if (existing) clearTimeout(existing);
        this.expiryTimers.delete(board.id);
        if (board.closedAt === null) {
            const timer = setTimeout(() => {
                this.expiryTimers.delete(board.id);
                void this.expireAndRefresh(board.id);
            }, Math.max(0, board.expiresAt - (this.options.now?.() ?? Date.now())));
            timer.unref();
            this.expiryTimers.set(board.id, timer);
        }
        if (!board.renderPending || this.refreshTimers.has(board.id)) return;
        const timer = setTimeout(() => {
            this.refreshTimers.delete(board.id);
            void this.refresh(board.id).catch(error => log.warn({ err: error, pollId: board.id }, 'Poll message refresh failed'));
        }, immediate ? 0 : this.options.debounceMs ?? 750);
        timer.unref();
        this.refreshTimers.set(board.id, timer);
    }

    async refresh(id: string): Promise<void> {
        const timer = this.refreshTimers.get(id);
        if (timer) clearTimeout(timer);
        this.refreshTimers.delete(id);
        const previous = this.rendering.get(id) ?? Promise.resolve();
        const next = previous.catch(() => undefined).then(async () => {
            if (this.stopped) return;
            const board = await this.manager.get(id);
            if (!board?.renderPending) return;
            await this.edit(board);
            await this.manager.markRendered(id, board.version);
            const current = await this.manager.get(id);
            if (current) this.track(current);
        });
        this.rendering.set(id, next);
        try {
            await next;
        } finally {
            if (this.rendering.get(id) === next) this.rendering.delete(id);
        }
    }

    stop(): void {
        this.stopped = true;
        if (this.sweepTimer) clearInterval(this.sweepTimer);
        this.sweepTimer = null;
        for (const timer of this.refreshTimers.values()) clearTimeout(timer);
        for (const timer of this.expiryTimers.values()) clearTimeout(timer);
        this.refreshTimers.clear();
        this.expiryTimers.clear();
    }

    private async sweep(): Promise<void> {
        if (this.sweeping || this.stopped) return;
        this.sweeping = true;
        try {
            for (const board of await this.manager.listForRecovery()) this.track(board, true);
        } finally {
            this.sweeping = false;
        }
    }

    private async expireAndRefresh(id: string): Promise<void> {
        try {
            const board = await this.manager.get(id);
            if (board) this.track(board, true);
        } catch (error) {
            log.warn({ err: error, pollId: id }, 'Poll expiry failed');
        }
    }
}

let activeRuntime: PollRuntime | null = null;

export async function initializePollRuntime(client: Client): Promise<void> {
    activeRuntime?.stop();
    activeRuntime = new PollRuntime(getConfigManager().pollManager, async board => {
        const channel = await client.channels.fetch(board.channelId);
        const matchesScope = board.guildId.startsWith('dm:')
            ? channel?.isDMBased() && 'recipientId' in channel && channel.recipientId === board.guildId.slice(3)
            : channel && 'guildId' in channel && channel.guildId === board.guildId;
        if (!channel?.isTextBased() || !('messages' in channel) || !matchesScope) {
            throw new Error('Poll channel is unavailable');
        }
        await channel.messages.edit(board.messageId, renderPollMessage(board));
    });
    await activeRuntime.start();
}

export function getPollRuntime(): PollRuntime {
    if (!activeRuntime) throw new Error('Poll runtime has not been initialized');
    return activeRuntime;
}

export function stopPollRuntime(): void {
    activeRuntime?.stop();
    activeRuntime = null;
}
