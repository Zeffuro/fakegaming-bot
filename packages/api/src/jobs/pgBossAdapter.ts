import type { Job, JobHandler, JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { getLogger } from '@zeffuro/fakegaming-common';

/**
 * PgBoss-backed JobQueue adapter
 */
export class PgBossJobQueue implements JobQueue {
    private boss: any | null = null;
    private readonly connectionString: string;
    private readonly log = getLogger({ name: 'api:jobs:pgboss' });
    private pendingHandlers = new Map<string, Array<JobHandler<any>>>();

    constructor(connectionString: string) {
        this.connectionString = connectionString;
    }

    async start(): Promise<void> {
        if (this.boss) return;
        const mod: any = await (Function('return import("pg-boss")')() as Promise<any>);
        const PgBoss = mod?.default ?? mod;
        this.boss = new PgBoss({ connectionString: this.connectionString });
        // Attach error listener to avoid process crash on emitted 'error'
        if (typeof this.boss?.on === 'function') {
            this.boss.on('error', (err: unknown) => {
                this.log.error({ err }, 'pg-boss error');
            });
        }
        await this.boss.start();
        this.log.info('pg-boss started');
        // Ensure queues exist for any pending handlers, then register them
        const names = new Set(this.pendingHandlers.keys());
        for (const name of names) {
            await this.ensureQueue(name);
        }
        for (const [name, handlers] of this.pendingHandlers.entries()) {
            for (const h of handlers) {
                await this.registerWork(name, h);
            }
        }
        this.pendingHandlers.clear();
    }

    async stop(): Promise<void> {
        if (!this.boss) return;
        try {
            await this.boss.stop();
        } finally {
            this.boss = null;
        }
    }

    private async ensureQueue(name: string): Promise<void> {
        if (!this.boss) return;
        try {
            const existing = await this.boss.getQueue?.(name);
            if (!existing) {
                await this.boss.createQueue?.(name);
            }
        } catch {
            // Fallback best-effort: attempt create and ignore if it already exists
            try { await this.boss.createQueue?.(name); } catch { /* noop */ }
        }
    }

    private async registerWork<T>(name: string, handler: JobHandler<T>): Promise<void> {
        if (!this.boss) {
            const list = this.pendingHandlers.get(name) || [];
            list.push(handler as JobHandler<any>);
            this.pendingHandlers.set(name, list);
            return;
        }
        const hasEnsure = typeof this.boss.getQueue === 'function' || typeof this.boss.createQueue === 'function';
        if (hasEnsure) {
            await this.ensureQueue(name);
        }
        // Do not await work() to keep synchronous semantics for tests/mocks
        this.boss.work(name, async (pgJob: any) => {
            const wrapped: Job<T> = {
                id: String(pgJob.id),
                name,
                data: (pgJob && pgJob.data) as T,
                attempts: Number(pgJob.attempts || 0),
                async done() { /* pg-boss auto-ack on resolve */ },
            };
            await handler(wrapped);
        });
    }

    on<T = unknown>(name: string, handler: JobHandler<T>): void {
        void this.registerWork(name, handler);
    }

    async schedule<T = unknown>(name: string, data: T, options?: { startAfterSeconds?: number; idempotencyKey?: string; priority?: number; }): Promise<string> {
        if (!this.boss) throw new Error('PgBossJobQueue not started');
        const hasEnsure = typeof this.boss.getQueue === 'function' || typeof this.boss.createQueue === 'function';
        if (hasEnsure) {
            await this.ensureQueue(name);
        }
        const startAfterSeconds = Math.max(0, Math.floor(options?.startAfterSeconds ?? 0));
        const opts: Record<string, unknown> = {};
        if (startAfterSeconds > 0) {
            opts.startAfter = new Date(Date.now() + startAfterSeconds * 1000);
        }
        if (options?.idempotencyKey) {
            opts.singletonKey = options.idempotencyKey;
        }
        if (typeof options?.priority === 'number') {
            opts.priority = options.priority;
        }
        let id: unknown;
        if (typeof this.boss.send === 'function') {
            id = await this.boss.send(name, data, opts);
        } else {
            id = await this.boss.publish(name, data, opts);
        }
        return String(id);
    }
}
