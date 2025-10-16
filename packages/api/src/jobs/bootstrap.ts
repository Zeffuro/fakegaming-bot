import { getLogger, MemoryJobQueue } from '@zeffuro/fakegaming-common';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { registerBirthdaysJobs } from './birthdays.js';
import { PgBossJobQueue } from './pgBossAdapter.js';
import { recordJobRun } from './status.js';

let activeQueue: JobQueue | null = null;

// Track last heartbeat for admin feedback endpoints
let lastHeartbeat: { startedAt: string; backend: string; receivedAt: string } | null = null;

export function getActiveJobQueue(): JobQueue | null {
    return activeQueue;
}

export function getLastHeartbeat(): { startedAt: string; backend: string; receivedAt: string } | null {
    return lastHeartbeat;
}

/**
 * Starts background jobs when enabled.
 * Uses in-memory queue for local dev; pg-boss when Postgres is configured.
 */
export async function bootstrapJobs(): Promise<void> {
    const log = getLogger({ name: 'api:jobs' });
    if (process.env.JOBS_ENABLED !== '1') {
        log.debug('Jobs disabled (JOBS_ENABLED!=1); skipping bootstrap');
        return;
    }

    const backend = (process.env.JOBS_BACKEND || '').toLowerCase();
    const backendName = backend === 'memory' ? 'memory' : 'pg-boss';
    let queue: JobQueue | null = null;

    if (backend === 'memory') {
        queue = new MemoryJobQueue();
    } else {
        if ((process.env.DATABASE_PROVIDER || '').toLowerCase() !== 'postgres') {
            log.warn('JOBS_ENABLED=1 but DATABASE_PROVIDER is not postgres and JOBS_BACKEND!=memory; skipping jobs bootstrap');
            return;
        }
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            log.warn('JOBS_ENABLED=1 but DATABASE_URL is missing; skipping jobs bootstrap');
            return;
        }
        queue = new PgBossJobQueue(databaseUrl);
    }

    // Common heartbeat (useful to confirm the worker is up)
    queue.on<{ startedAt?: string; backend?: string }>('heartbeat', async (job) => {
        const nowIso = new Date().toISOString();
        const startedAt = job.data?.startedAt ?? nowIso;
        const backendVal = job.data?.backend ?? backendName;
        lastHeartbeat = { startedAt, backend: backendVal, receivedAt: nowIso };
        log.info({ payload: job.data ?? { startedAt, backend: backendVal } }, 'heartbeat');
        // Record status for admin/status endpoint
        recordJobRun('heartbeat', { startedAt, finishedAt: nowIso, ok: true, meta: { backend: backendVal } });
        await job.done();
    });

    await queue.start();
    activeQueue = queue;

    await queue.schedule('heartbeat', { startedAt: new Date().toISOString(), backend: backendName });

    // Register and schedule birthdays job
    await registerBirthdaysJobs(queue);

    log.info({ backend: backendName }, 'Jobs bootstrap complete');
}
