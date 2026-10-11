import { afterEach, describe, it, expect, vi } from 'vitest';
import { MemoryJobQueue } from '../memory.js';

afterEach(() => { vi.useRealTimers(); });

describe('MemoryJobQueue', () => {
    it('deduplicates keyed pending, active and completed jobs until retention expires', async () => {
        vi.useFakeTimers();
        const queue = new MemoryJobQueue();
        await queue.start();
        let release!: () => void;
        const pending = new Promise<void>(resolve => { release = resolve; });
        const handler = vi.fn(async () => { await pending; });
        queue.on('poll', handler);
        const options = { idempotencyKey: 'slot', startAfterSeconds: 1, retentionSeconds: 2 };
        const id = await queue.schedule('poll', {}, options);
        expect(await queue.schedule('poll', {}, options)).toBe(id);
        vi.advanceTimersByTime(1000);
        expect(await queue.schedule('poll', {}, options)).toBe(id);
        release();
        await vi.advanceTimersByTimeAsync(0);
        expect(handler).toHaveBeenCalledOnce();
        expect(await queue.schedule('poll', {}, options)).toBe(id);
        await vi.advanceTimersByTimeAsync(2000);
        expect(await queue.schedule('poll', {}, options)).not.toBe(id);
        await queue.stop();
    });

    it('separates queue names, later slots and unkeyed jobs', async () => {
        const queue = new MemoryJobQueue();
        await queue.start();
        const first = await queue.schedule('youtube', {}, { idempotencyKey: 'slot:1', startAfterSeconds: 60 });
        expect(await queue.schedule('twitch', {}, { idempotencyKey: 'slot:1', startAfterSeconds: 60 })).not.toBe(first);
        expect(await queue.schedule('youtube', {}, { idempotencyKey: 'slot:2', startAfterSeconds: 60 })).not.toBe(first);
        expect(await queue.schedule('youtube', {}, { startAfterSeconds: 60 })).not.toBe(await queue.schedule('youtube', {}, { startAfterSeconds: 60 }));
        await queue.stop();
        await expect(queue.schedule('youtube', {})).rejects.toThrow('not started');
    });

    it('retains a pending key through delays longer than the default retention', async () => {
        vi.useFakeTimers();
        const queue = new MemoryJobQueue();
        await queue.start();
        const handler = vi.fn(async () => undefined);
        queue.on('later', handler);
        const options = { idempotencyKey: 'future', startAfterSeconds: 172_800 };
        const id = await queue.schedule('later', {}, options);
        await vi.advanceTimersByTimeAsync(86_401_000);
        expect(await queue.schedule('later', {}, options)).toBe(id);
        expect(handler).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(86_399_000);
        expect(handler).toHaveBeenCalledOnce();
        expect(await queue.schedule('later', {}, options)).toBe(id);
        await queue.stop();
    });
    it('invokes handler for immediate job', async () => {
        const q = new MemoryJobQueue();
        await q.start();
        const seen: any[] = [];
        q.on('test', async (job) => {
            seen.push(job.data);
            await job.done();
        });
        await q.schedule('test', { a: 1 });
        // Allow next tick to flush
        await new Promise((r) => setTimeout(r, 0));
        expect(seen).toEqual([{ a: 1 }]);
        await q.stop();
    });

    it('invokes handler after delay', async () => {
        vi.useFakeTimers();
        const q = new MemoryJobQueue();
        await q.start();
        const seen: any[] = [];
        q.on('test-delay', async (job) => {
            seen.push(job.data);
            await job.done();
        });
        await q.schedule('test-delay', { b: 2 }, { startAfterSeconds: 2 });
        // Not yet
        expect(seen).toEqual([]);
        // Advance 2 seconds
        vi.advanceTimersByTime(2000);
        // Flush microtasks
        await Promise.resolve();
        expect(seen).toEqual([{ b: 2 }]);
        await q.stop();
        vi.useRealTimers();
    });
});

