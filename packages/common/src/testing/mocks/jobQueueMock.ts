// filepath: f:\Coding\discord-bot\packages\common\src\testing\mocks\jobQueueMock.ts
import type { JobHandler, JobQueue } from '../../jobs/index.js';
import { vi } from 'vitest';

/**
 * Lightweight in-memory JobQueue for unit tests that need to inspect handlers directly.
 * - Stores only the latest handler per job name (sufficient for our tests)
 * - Captures scheduled jobs for optional assertions
 * - Does not run timers; `schedule` is a no-op that returns a fake id
 */
export class TestJobQueue implements JobQueue {
    public handlers: Map<string, JobHandler<any>> = new Map();
    public scheduled: Array<{ name: string; data: unknown; options?: { startAfterSeconds?: number; idempotencyKey?: string; priority?: number } }> = [];

    async start(): Promise<void> { /* no-op */ }
    async stop(): Promise<void> { /* no-op */ }

    on<T = unknown>(name: string, handler: JobHandler<T>): void {
        // Keep the latest handler for ease of access in tests
        this.handlers.set(name, handler as JobHandler<any>);
    }

    async schedule<T = unknown>(name: string, data: T, options?: { startAfterSeconds?: number; idempotencyKey?: string; priority?: number }): Promise<string> {
        this.scheduled.push({ name, data, options });
        return 'id';
    }
}

/** Get a registered handler by name (throws if missing). */
export function getJobHandler<T = unknown>(q: TestJobQueue, name: string): JobHandler<T> {
    const h = q.handlers.get(name) as JobHandler<T> | undefined;
    if (!h) throw new Error(`Handler not found for job: ${name}`);
    return h;
}

/** Run a registered handler with minimal Job envelope and return the done spy. */
export async function runJobHandler<T = unknown>(q: TestJobQueue, name: string, data: T): Promise<{ done: ReturnType<typeof vi.fn> }> {
    const h = getJobHandler<T>(q, name);
    const done = vi.fn();
    await h({ id: 'test', name, data, attempts: 0, done } as any);
    return { done };
}
