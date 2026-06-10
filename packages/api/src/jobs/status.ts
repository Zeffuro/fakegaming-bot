import { Op } from 'sequelize';
import { getLogger, JobRun } from '@zeffuro/fakegaming-common';

export interface JobRunEntry {
    startedAt: string;
    finishedAt: string;
    ok: boolean;
    meta?: Record<string, unknown>;
    error?: string;
}

const MAX_ENTRIES = 10;
const registry = new Map<string, JobRunEntry[]>();
const log = getLogger({ name: 'api:jobs:status' });
let cleanupTimer: NodeJS.Timeout | undefined;

function readPositiveNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function shouldPersistJobRun(entry: JobRunEntry): boolean {
    if (!entry.ok) return true;
    const sampleRate = readNonNegativeNumberEnv('JOB_RUN_SUCCESS_SAMPLE_RATE', 1);
    if (sampleRate >= 1) return true;
    if (sampleRate <= 0) return false;
    return Math.random() < sampleRate;
}

/**
 * Save a job run to the database. Also keeps a small in-memory cache in this module.
 */
export async function saveJobRun(name: string, entry: JobRunEntry): Promise<void> {
    // Update memory cache first (synchronous)
    const list = registry.get(name) ?? [];
    list.unshift(entry);
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    registry.set(name, list);

    // Persist to DB (best-effort)
    if (!shouldPersistJobRun(entry)) return;
    try {
        await JobRun.create({
            name,
            startedAt: new Date(entry.startedAt),
            finishedAt: new Date(entry.finishedAt),
            ok: entry.ok,
            meta: entry.meta ? entry.meta : null,
            error: entry.error ? entry.error : null,
        });
    } catch {
        // swallow persistence errors for now to avoid impacting job flow
    }
}

export async function cleanupJobRuns(options?: { retentionDays?: number; maxRowsPerJob?: number }): Promise<{ deletedOlderThanRetention: number; deletedOverLimit: number }> {
    const retentionDays = options?.retentionDays ?? readPositiveNumberEnv('JOB_RUN_RETENTION_DAYS', 7);
    const maxRowsPerJob = Math.floor(options?.maxRowsPerJob ?? readPositiveNumberEnv('JOB_RUN_MAX_ROWS_PER_JOB', 1000));
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deletedOlderThanRetention = await JobRun.destroy({
        where: {
            finishedAt: { [Op.lt]: cutoff },
        },
    });

    let deletedOverLimit = 0;
    const sequelize = JobRun.sequelize;
    if (sequelize && maxRowsPerJob > 0) {
        const [, metadata] = await sequelize.query(
            `
            DELETE FROM "JobRuns"
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY name
                            ORDER BY "finishedAt" DESC, id DESC
                        ) AS row_num
                    FROM "JobRuns"
                ) ranked
                WHERE ranked.row_num > :maxRowsPerJob
            )
            `,
            { replacements: { maxRowsPerJob } },
        );
        deletedOverLimit = Number((metadata as { rowCount?: number } | undefined)?.rowCount ?? 0);
    }

    return { deletedOlderThanRetention, deletedOverLimit };
}

export function scheduleJobRunCleanup(): void {
    if (process.env.NODE_ENV === 'test' || process.env.OPENAPI_BUILD === '1') return;
    if (cleanupTimer) return;

    const intervalMs = readPositiveNumberEnv('JOB_RUN_CLEANUP_INTERVAL_MS', 60 * 60 * 1000);
    const runCleanup = () => {
        cleanupJobRuns().then((result) => {
            if (result.deletedOlderThanRetention > 0 || result.deletedOverLimit > 0) {
                log.info(result, 'Cleaned up old job run rows');
            }
        }).catch((err) => {
            log.warn({ err }, 'Job run cleanup failed');
        });
    };

    runCleanup();
    cleanupTimer = setInterval(runCleanup, intervalMs);
    cleanupTimer.unref?.();
}

export function recordJobRun(name: string, entry: JobRunEntry): void {
    // fire-and-forget persistence to keep legacy signature
    void saveJobRun(name, entry);
}

export function getJobRuns(name: string): JobRunEntry[] {
    return registry.get(name) ?? [];
}
