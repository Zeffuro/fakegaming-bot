import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import { registerRecurringPollingJob } from '../recurringPollingJob.js';
import { PgBossJobQueue } from '../pgBossAdapter.js';
import { MemoryJobQueue } from '@zeffuro/fakegaming-common/jobs';

vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

const start = new Date('2026-10-11T12:01:02.300Z');
const intervalMs = 300_000;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start);
});
afterEach(() => { vi.useRealTimers(); });

async function setup(run = vi.fn(async () => ({ processed: 1, errors: 0 }))) {
    const queue = new TestJobQueue();
    await registerRecurringPollingJob({ queue, provider: 'youtube', jobName: 'youtube:poll', intervalSeconds: 300, catchupDelaySeconds: 2, run });
    return { queue, run };
}

describe('canonical recurring polling slots', () => {
    it('runs one memory polling chain after startup and stops without rescheduling', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(start);
        const queue = new MemoryJobQueue();
        await queue.start();
        const run = vi.fn(async () => ({ processed: 1, errors: 0 }));
        await registerRecurringPollingJob({ queue, provider: 'youtube', jobName: 'youtube:poll', intervalSeconds: 300, catchupDelaySeconds: 2, run });
        await vi.advanceTimersByTimeAsync(2000);
        expect(run).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(1);
        await vi.advanceTimersByTimeAsync(1_798_000);
        expect(run).toHaveBeenCalledTimes(7);
        expect(vi.getTimerCount()).toBe(1);
        await queue.stop();
        await vi.advanceTimersByTimeAsync(300_000);
        expect(run).toHaveBeenCalledTimes(7);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not revive a stopped memory queue when an active poll finishes', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(start);
        const queue = new MemoryJobQueue();
        await queue.start();
        let release!: () => void;
        const waiting = new Promise<void>(resolve => { release = resolve; });
        const run = vi.fn(async () => { await waiting; return { processed: 1, errors: 0 }; });
        await registerRecurringPollingJob({ queue, provider: 'youtube', jobName: 'youtube:poll', intervalSeconds: 300, run });
        await vi.advanceTimersByTimeAsync(0);
        expect(run).toHaveBeenCalledOnce();
        await queue.stop();
        release();
        await vi.advanceTimersByTimeAsync(300_000);
        expect(run).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('coalesces startup and overlapping handlers into the same next five-minute slot', async () => {
        const { queue } = await setup();
        const next = queue.scheduled[1];
        expect(queue.scheduled[0].options?.startAfterSeconds).toBe(2);
        expect(next.options?.startAfterSeconds).toBe(238);
        await Promise.all([runJobHandler(queue, 'youtube:poll', queue.scheduled[0].data), runJobHandler(queue, 'youtube:poll', {})]);
        expect(queue.scheduled.slice(2)).toEqual([next, next]);
        expect(next.options?.idempotencyKey).toBe(`youtube:slot:${Math.floor(start.getTime() / intervalMs) + 1}`);
    });

    it('schedules the next boundary after slow work rather than drifting by an interval', async () => {
        const { queue } = await setup(vi.fn(async () => {
            vi.setSystemTime(new Date('2026-10-11T12:06:19.500Z'));
            return { processed: 1, errors: 0 };
        }));
        await runJobHandler(queue, 'youtube:poll', {});
        expect(queue.scheduled.at(-1)?.options).toMatchObject({ startAfterSeconds: 221, idempotencyKey: `youtube:slot:${new Date('2026-10-11T12:10:00Z').getTime() / intervalMs}` });
    });

    it('moves past its carried slot even when delivery occurs just before its boundary', async () => {
        const { queue } = await setup();
        const next = queue.scheduled[1];
        vi.setSystemTime(new Date('2026-10-11T12:04:59.999Z'));
        await runJobHandler(queue, 'youtube:poll', next.data);
        expect(queue.scheduled.at(-1)?.options).toMatchObject({ startAfterSeconds: 301, idempotencyKey: `youtube:slot:${new Date('2026-10-11T12:10:00Z').getTime() / intervalMs}` });
        expect(queue.scheduled.at(-1)?.options?.idempotencyKey).not.toBe(next.options?.idempotencyKey);
    });

    it('continues the chain after an unexpected polling failure', async () => {
        const { queue } = await setup(vi.fn(async () => { throw new Error('provider failed'); }));
        const { done } = await runJobHandler(queue, 'youtube:poll', {});
        expect(done).toHaveBeenCalledOnce();
        expect(queue.scheduled[2]).toEqual(queue.scheduled[1]);
    });

    it('propagates successor scheduling failure for the queue retry', async () => {
        const { queue } = await setup();
        vi.spyOn(queue, 'schedule').mockRejectedValueOnce(new Error('queue unavailable'));
        const done = vi.fn();
        await expect(queue.handlers.get('youtube:poll')!({ id: 'job', name: 'youtube:poll', data: {}, attempts: 0, done })).rejects.toThrow('queue unavailable');
        expect(done).toHaveBeenCalledOnce();
    });

    it('passes canonical startup and successor IDs through the adapter insert contract', async () => {
        // This mock exercises ID collisions; PostgreSQL insertion is verified separately.
        const queue = new PgBossJobQueue('postgres://mock');
        const inserted = new Map<string, unknown>();
        let handler!: (jobs: Array<{ id: string; data: { slot: number }; retryCount: number }>) => Promise<void>;
        const send = vi.fn(async (_name: string, data: unknown, options: Record<string, unknown>) => {
            const id = String(options.id);
            if (inserted.has(id)) return null;
            inserted.set(id, data);
            return id;
        });
        (queue as any).boss = { send, work: (_name: string, _options: unknown, fn: typeof handler) => { handler = fn; } };
        await registerRecurringPollingJob({ queue, provider: 'youtube', jobName: 'youtube:poll', intervalSeconds: 300, run: async () => ({ processed: 1, errors: 0 }) });
        const [currentId, nextId] = [...inserted.keys()];
        await Promise.all([handler([{ id: currentId, data: inserted.get(currentId) as { slot: number }, retryCount: 0 }]), handler([{ id: 'legacy', data: {} as { slot: number }, retryCount: 0 }])]);
        expect(inserted.size).toBe(2);
        expect(send.mock.calls.slice(2).map(call => call[2].id)).toEqual([nextId, nextId]);
        vi.setSystemTime(new Date('2026-10-11T12:05:00Z'));
        await handler([{ id: nextId, data: inserted.get(nextId) as { slot: number }, retryCount: 0 }]);
        expect(inserted.size).toBe(3);
    });
});
