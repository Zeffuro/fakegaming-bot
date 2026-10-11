import type { Job, JobHandler, JobQueue, JobScheduleOptions } from './index.js';

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
    private keyedJobs = new Map<string, { id: string; expiresAt: number | null }>();

    async start(): Promise<void> {
        this.started = true;
    }

    async stop(): Promise<void> {
        this.started = false;
        for (const t of this.timers) clearTimeout(t);
        this.timers.clear();
        this.handlers.clear();
        this.keyedJobs.clear();
    }

    on<T = unknown>(name: string, handler: JobHandler<T>): void {
        const list = this.handlers.get(name) || [];
        list.push(handler as JobHandler<any>);
        this.handlers.set(name, list);
    }

    async schedule<T = unknown>(name: string, data: T, options?: JobScheduleOptions): Promise<string> {
        if (!this.started) throw new Error('MemoryJobQueue not started');
        const key = options?.idempotencyKey ? JSON.stringify([name, options.idempotencyKey]) : null;
        if (key) {
            for (const [storedKey, entry] of this.keyedJobs) {
                if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) this.keyedJobs.delete(storedKey);
            }
            const existing = this.keyedJobs.get(key);
            if (existing) return existing.id;
        }
        const delayMs = Math.max(0, Math.floor((options?.startAfterSeconds ?? 0) * 1000));
        const id = uuid();
        const entry = { id, expiresAt: null as number | null };
        if (key) this.keyedJobs.set(key, entry);
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
            void Promise.all(list.map(async fn => {
                await Promise.resolve(fn(job as any)).catch(() => {
                    // Swallow to avoid unhandled rejection in dev; tests should assert behavior explicitly
                });
            })).finally(() => {
                entry.expiresAt = Date.now() + Math.max(0, options?.retentionSeconds ?? 86_400) * 1000;
            });
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

