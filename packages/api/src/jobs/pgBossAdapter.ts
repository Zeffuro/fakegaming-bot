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
        await this.boss.start();
        this.log.info('pg-boss started');
        // Register any pending handlers
        for (const [name, handlers] of this.pendingHandlers.entries()) {
            for (const h of handlers) {
                this.registerWork(name, h);
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

    private registerWork<T>(name: string, handler: JobHandler<T>) {
        if (!this.boss) {
            const list = this.pendingHandlers.get(name) || [];
            list.push(handler as JobHandler<any>);
            this.pendingHandlers.set(name, list);
            return;
        }
        void this.boss.work(name, async (pgJob: any) => {
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
        this.registerWork(name, handler);
    }

    async schedule<T = unknown>(name: string, data: T, options?: { startAfterSeconds?: number; idempotencyKey?: string; priority?: number; }): Promise<string> {
        if (!this.boss) throw new Error('PgBossJobQueue not started');
        const startAfterSeconds = Math.max(0, Math.floor(options?.startAfterSeconds ?? 0));
        const publishOptions: Record<string, unknown> = {};
        if (startAfterSeconds > 0) {
            publishOptions.startAfter = new Date(Date.now() + startAfterSeconds * 1000);
        }
        if (options?.idempotencyKey) {
            publishOptions.singletonKey = options.idempotencyKey;
        }
        const id = await this.boss.publish(name, data, publishOptions);
        return String(id);
    }
}
