// Minimal in-memory job status tracking for admin feedback

export interface JobRunEntry {
    startedAt: string;
    finishedAt: string;
    ok: boolean;
    meta?: Record<string, unknown>;
    error?: string;
}

const MAX_ENTRIES = 10;
const registry = new Map<string, JobRunEntry[]>();

// Persist to DB (async) and also store in-memory
import { JobRun } from '@zeffuro/fakegaming-common';

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

export function recordJobRun(name: string, entry: JobRunEntry): void {
    // fire-and-forget persistence to keep legacy signature
    void saveJobRun(name, entry);
}

export function getJobRuns(name: string): JobRunEntry[] {
    return registry.get(name) ?? [];
}
