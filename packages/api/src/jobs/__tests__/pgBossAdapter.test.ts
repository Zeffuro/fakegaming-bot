import { describe, it, expect, beforeEach } from 'vitest';
import { PgBossJobQueue } from '../pgBossAdapter.js';

class MockBoss {
    public started = false;
    public works: Array<{ name: string; fn: (pgJob: any) => Promise<void> | void }> = [];
    public lastPublish: { name: string; data: unknown; options: Record<string, unknown> } | null = null;
    constructor(_cfg?: any) {}
    async start() { this.started = true; }
    async stop() { this.started = false; }
    work(name: string, fn: (pgJob: any) => Promise<void> | void) { this.works.push({ name, fn }); }
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
        await work.fn({ id: 7, data: { x: 1 }, attempts: 2 });
        expect(handled).toEqual(['test:job', { x: 1 }, 2, '7']);
    });

    it('schedules jobs with startAfter and singletonKey options', async () => {
        const id = await queue.schedule('another:job', { y: 2 }, { startAfterSeconds: 5, idempotencyKey: 'abc' });
        expect(id).toBe('123');
        expect(boss.lastPublish).toBeTruthy();
        expect(boss.lastPublish!.name).toBe('another:job');
        expect(boss.lastPublish!.data).toEqual({ y: 2 });
        expect(boss.lastPublish!.options).toHaveProperty('startAfter');
        expect(boss.lastPublish!.options).toHaveProperty('singletonKey', 'abc');
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
        expect(boss.lastPublish!.name).toBe('simple:job');
        expect(boss.lastPublish!.options).toEqual({});
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
