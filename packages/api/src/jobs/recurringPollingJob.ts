import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { formatMinuteKey, scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import { recordJobRun } from './status.js';

export interface PollingJobResult {
    processed: number;
    errors: number;
}

export interface RecurringPollingJobOptions {
    queue: JobQueue;
    provider: string;
    jobName: string;
    intervalSeconds: number;
    initialDelaySeconds: number;
    catchupDelaySeconds?: number;
    now?: Date;
    run: () => Promise<PollingJobResult>;
}

export async function registerRecurringPollingJob(options: RecurringPollingJobOptions): Promise<void> {
    const now = options.now ?? new Date();

    options.queue.on(options.jobName, async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const { processed, errors } = await options.run();
            const nextAt = new Date(Date.now() + options.intervalSeconds * 1000);
            const key = `${options.provider}:next:${formatMinuteKey(nextAt)}`;
            await scheduleSingleton(options.queue, options.jobName, {}, options.intervalSeconds, key);
            recordJobRun(options.provider, { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { processed, errors } });
        } catch (err) {
            recordJobRun(options.provider, { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    const catchupDelaySeconds = options.catchupDelaySeconds ?? 0;
    await scheduleSingleton(
        options.queue,
        options.jobName,
        {},
        options.initialDelaySeconds,
        `${options.provider}:init:${formatMinuteKey(new Date(now.getTime() + options.initialDelaySeconds * 1000))}`,
    );
    await scheduleSingleton(
        options.queue,
        options.jobName,
        {},
        catchupDelaySeconds,
        `${options.provider}:catchup:${formatMinuteKey(new Date(now.getTime() + catchupDelaySeconds * 1000))}`,
    );
}
