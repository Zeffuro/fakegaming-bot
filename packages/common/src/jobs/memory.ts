import type { Job, JobHandler, JobQueue } from './index.js';

function uuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    // Fallback
    return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * In-memory JobQueue for local dev/testing. Not durable. Single-process only.
 */
export class MemoryJobQueue implements JobQueue {
    private started = false;
    private handlers = new Map<string, Array<JobHandler<any>>>();
    private timers = new Set<NodeJS.Timeout>();

    async start(): Promise<void> {
        this.started = true;
    }

    async stop(): Promise<void> {
        this.started = false;
        for (const t of this.timers) clearTimeout(t);
        this.timers.clear();
        this.handlers.clear();
    }

    on<T = unknown>(name: string, handler: JobHandler<T>): void {
        const list = this.handlers.get(name) || [];
        list.push(handler as JobHandler<any>);
        this.handlers.set(name, list);
    }

    async schedule<T = unknown>(name: string, data: T, options?: { startAfterSeconds?: number; idempotencyKey?: string; priority?: number; }): Promise<string> {
        // idempotencyKey and priority are ignored in memory mode
        const delayMs = Math.max(0, Math.floor((options?.startAfterSeconds ?? 0) * 1000));
        const id = uuid();
        const attempts = 0;
        const fire = () => {
            const job: Job<T> = {
                id,
                name,
                data,
                attempts,
                async done() { /* no-op */ },
            };
            const list = this.handlers.get(name) || [];
            for (const fn of list) {
                Promise.resolve(fn(job as any)).catch(() => {
                    // Swallow to avoid unhandled rejection in dev; tests should assert behavior explicitly
                });
            }
        };
        if (delayMs > 0) {
            const t = setTimeout(() => { this.timers.delete(t); fire(); }, delayMs);
            this.timers.add(t);
        } else {
            // Schedule on next tick
            const t = setTimeout(() => { this.timers.delete(t); fire(); }, 0);
            this.timers.add(t);
        }
        return id;
    }
}

