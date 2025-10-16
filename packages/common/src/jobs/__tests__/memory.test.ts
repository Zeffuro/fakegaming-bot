import { describe, it, expect, vi } from 'vitest';
import { MemoryJobQueue } from '../memory.js';

describe('MemoryJobQueue', () => {
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

