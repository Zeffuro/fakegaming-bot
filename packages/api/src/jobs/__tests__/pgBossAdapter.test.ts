import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PgBossJobQueue, resolvePgBossConstructor, toPgBossQueueName } from '../pgBossAdapter.js';

class MockBoss {
    public started = false;
    public works: Array<{ name: string; options: { includeMetadata: boolean; batchSize: number }; fn: (pgJobs: any[]) => Promise<void> }> = [];
    public lastPublish: { name: string; data: unknown; options: Record<string, unknown> } | null = null;
    constructor(_cfg?: any) {}
    async start() { this.started = true; }
    async stop() { this.started = false; }
    work(name: string, options: { includeMetadata: boolean; batchSize: number }, fn: (pgJobs: any[]) => Promise<void>) {
        this.works.push({ name, options, fn });
    }
    async publish(name: string, data: unknown, options: Record<string, unknown>) { this.lastPublish = { name, data, options }; return 123; }
}

describe('PgBossJobQueue (with injected boss)', () => {
    let queue: PgBossJobQueue;
    let boss: MockBoss;

    beforeEach(() => {
        queue = new PgBossJobQueue('postgres://mock');
        boss = new MockBoss();
        // Inject boss to avoid hitting dynamic import path in start()
        (queue as any).boss = boss;
    });

    it('registers work immediately when boss is present and invokes handler', async () => {
        const handled: any[] = [];
        queue.on('test:job', async (job) => {
            handled.push(job.name, job.data, job.attempts, job.id);
            await job.done();
        });
        expect(boss.works.length).toBe(1);
        const work = boss.works[0];
        expect(work.name).toBe('test/job');
        expect(work.options).toEqual({ includeMetadata: true, batchSize: 1 });
        await work.fn([{ id: '7', data: { x: 1 }, retryCount: 2 }]);
        expect(handled).toEqual(['test:job', { x: 1 }, 2, '7']);
    });

    it('handles every batch item sequentially with independent payloads and retry metadata', async () => {
        const handled: string[] = [];
        let releaseFirst: (() => void) | undefined;
        const firstFinished = new Promise<void>(resolve => { releaseFirst = resolve; });
        const handler = vi.fn(async (job) => {
            handled.push(job.id);
            if (job.id === 'first') await firstFinished;
        });
        queue.on('batch:job', handler);
        const processing = boss.works[0].fn([
            { id: 'first', data: { value: 1 }, retryCount: 0 },
            { id: 'second', data: { value: 2 }, retryCount: 3 },
        ]);
        expect(handled).toEqual(['first']);
        releaseFirst!();
        await processing;
        expect(handled).toEqual(['first', 'second']);
        expect(handler.mock.calls[0][0]).toMatchObject({ id: 'first', name: 'batch:job', data: { value: 1 }, attempts: 0 });
        expect(handler.mock.calls[1][0]).toMatchObject({ id: 'second', name: 'batch:job', data: { value: 2 }, attempts: 3 });
    });

    it('propagates handler failures to pg-boss and does not run later batch items', async () => {
        const failure = new Error('delivery failed');
        const handled: string[] = [];
        queue.on('failing:job', async job => {
            handled.push(job.id);
            if (job.id === 'failed') throw failure;
        });
        await expect(boss.works[0].fn([
            { id: 'first', data: {}, retryCount: 0 },
            { id: 'failed', data: {}, retryCount: 1 },
            { id: 'later', data: {}, retryCount: 0 },
        ])).rejects.toBe(failure);
        expect(handled).toEqual(['first', 'failed']);
    });

    it('accepts an empty batch without inventing a job', async () => {
        const handler = vi.fn(async () => undefined);
        queue.on('empty:job', handler);
        await boss.works[0].fn([]);
        expect(handler).not.toHaveBeenCalled();
    });

    it('schedules jobs with startAfter and singletonKey options', async () => {
        const id = await queue.schedule('another:job', { y: 2 }, { startAfterSeconds: 5, idempotencyKey: 'abc' });
        expect(id).toBe('123');
        expect(boss.lastPublish).toBeTruthy();
        expect(boss.lastPublish!.name).toBe('another/job');
        expect(boss.lastPublish!.data).toEqual({ y: 2 });
        expect(boss.lastPublish!.options).toHaveProperty('startAfter');
        expect(boss.lastPublish!.options).toHaveProperty('singletonKey', 'abc');
        expect(boss.lastPublish!.options).toHaveProperty('retentionSeconds', 86400);
        expect(boss.lastPublish!.options).toHaveProperty('deleteAfterSeconds', 86400);
    });

    it('throws when scheduling before boss is injected', async () => {
        const q2 = new PgBossJobQueue('postgres://mock');
        await expect(q2.schedule('oops', {})).rejects.toThrow('not started');
    });

    it('stop clears boss when present', async () => {
        await queue.stop();
        expect((queue as any).boss).toBeNull();
    });

    it('on() stores pending handler when boss is null', () => {
        const q2 = new PgBossJobQueue('postgres://mock');
        let executed = false;
        q2.on('later:job', async (_job) => { executed = true; });
        // Access internal for assertion
        const pending = (q2 as any).pendingHandlers;
        expect(pending.size).toBe(1);
        expect(executed).toBe(false);
    });

    it('schedule without options does not set startAfter/singletonKey', async () => {
        await queue.schedule('simple:job', { z: 3 });
        expect(boss.lastPublish).toBeTruthy();
        expect(boss.lastPublish!.name).toBe('simple/job');
        expect(boss.lastPublish!.options).toEqual({ retentionSeconds: 86400, deleteAfterSeconds: 86400 });
    });

    it('stop is a no-op when boss is already null', async () => {
        const q2 = new PgBossJobQueue('postgres://mock');
        await q2.stop();
        expect((q2 as any).boss).toBeNull();
    });

    it('start is a no-op when boss is already set', async () => {
        // boss already injected in beforeEach
        await queue.start();
        // Ensure it did not clear or duplicate works
        expect((queue as any).boss).toBe(boss);
    });
});

describe('resolvePgBossConstructor', () => {
    it('uses the pg-boss v12 named ESM export', () => {
        expect(resolvePgBossConstructor({ PgBoss: MockBoss })).toBe(MockBoss);
    });

    it('uses a default constructor export', () => {
        expect(resolvePgBossConstructor({ default: MockBoss })).toBe(MockBoss);
    });

    it('uses a default object with PgBoss export', () => {
        expect(resolvePgBossConstructor({ default: { PgBoss: MockBoss } })).toBe(MockBoss);
    });

    it('uses a CommonJS-style constructor export', () => {
        expect(resolvePgBossConstructor(MockBoss)).toBe(MockBoss);
    });

    it('throws when no constructor is exported', () => {
        expect(() => resolvePgBossConstructor({})).toThrow('pg-boss did not export a PgBoss constructor');
    });
});

describe('toPgBossQueueName', () => {
    it('maps logical colon-delimited job names to pg-boss-safe queue names', () => {
        expect(toPgBossQueueName('twitch:poll')).toBe('twitch/poll');
        expect(toPgBossQueueName('reminders:run')).toBe('reminders/run');
    });

    it('replaces other invalid pg-boss queue characters', () => {
        expect(toPgBossQueueName('bad queue:name')).toBe('bad_queue/name');
    });

    it('throws on an empty queue name', () => {
        expect(() => toPgBossQueueName('')).toThrow('Job queue name cannot be empty');
    });
});
