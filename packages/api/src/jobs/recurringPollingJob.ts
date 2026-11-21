import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import { recordJobRun } from './status.js';

export interface PollingJobResult {
    errors: number;
}

export interface RecurringPollingJobOptions {
    queue: JobQueue;
    provider: string;
    jobName: string;
    intervalSeconds: number;
    jitterSeconds?: number;
    catchupDelaySeconds?: number;
    now?: Date;
    run: () => Promise<PollingJobResult>;
}

export async function registerRecurringPollingJob(options: RecurringPollingJobOptions): Promise<void> {
    const now = options.now ?? new Date();
    const intervalMs = options.intervalSeconds * 1000;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError('Polling interval must be positive');
    const scheduleSlot = (slot: number, delaySeconds: number) => scheduleSingleton(
        options.queue, options.jobName, { slot }, delaySeconds, `${options.provider}:slot:${slot}`,
    );
    const scheduleNextSlot = (slot: number, from: number) => {
        const jitter = options.jitterSeconds ? Math.floor(Math.random() * options.jitterSeconds) : 0;
        return scheduleSlot(slot, Math.ceil((slot * intervalMs - from) / 1000) + jitter);
    };

    options.queue.on<{ slot?: number }>(options.jobName, async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const result = await options.run();
            recordJobRun(options.provider, { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: { ...result } });
        } catch (err) {
            recordJobRun(options.provider, { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            try {
                const finishedAt = Date.now();
                const currentSlot = Math.floor(finishedAt / intervalMs);
                const carriedSlot = Number.isSafeInteger(job.data?.slot) ? job.data.slot! : currentSlot;
                const slot = Math.max(currentSlot, carriedSlot) + 1;
                await scheduleNextSlot(slot, finishedAt);
            } finally {
                await job.done();
            }
        }
    });

    const catchupDelaySeconds = options.catchupDelaySeconds ?? 0;
    const currentSlot = Math.floor(now.getTime() / intervalMs);
    await scheduleSlot(currentSlot, catchupDelaySeconds);
    await scheduleNextSlot(currentSlot + 1, now.getTime());
}
