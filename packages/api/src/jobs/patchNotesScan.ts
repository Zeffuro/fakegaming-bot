import {getLogger} from '@zeffuro/fakegaming-common';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import type {JobQueue} from '@zeffuro/fakegaming-common/jobs';
import {scheduleSingleton} from '@zeffuro/fakegaming-common/jobs';
import {getDefaultPatchNoteFetchers} from '@zeffuro/fakegaming-common/patchnotes';
import {recordJobRun} from './status.js';

export function computeNextScanDelaySeconds(): number {
    // Base 20 minutes with +/- 5 minutes jitter
    const base = 20 * 60;
    const jitter = Math.floor((Math.random() * 600) - 300); // -300..+300 seconds
    return Math.max(300, base + jitter);
}

async function processPatchNotesScan(log = getLogger({ name: 'api:jobs:patchnotes:scan' })): Promise<{ updated: number; total: number; errors: number }> {
    const cm = getConfigManager();
    const fetchers = getDefaultPatchNoteFetchers();
    let updated = 0;
    let errors = 0;

    for (const fetcher of fetchers) {
        try {
            const latestStored = await cm.patchNotesManager.getLatestPatch(fetcher.game);
            const latestPatch = await fetcher.fetchLatestPatchNote(latestStored?.version ?? undefined);
            if (!latestPatch) continue;
            await cm.patchNotesManager.setLatestPatch({ ...latestPatch, game: fetcher.game } as any);
            updated += 1;
        } catch (err) {
            errors += 1;
            log.error({ err, game: fetcher.game }, 'Failed to scan patch notes');
        }
    }

    return { updated, total: fetchers.length, errors };
}

export async function registerPatchNotesScanJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:patchnotes:scan' });

    queue.on('patchnotes:scan', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const { updated, total, errors } = await processPatchNotesScan(log);
            const delay = computeNextScanDelaySeconds();
            await scheduleSingleton(queue, 'patchnotes:scan', {}, delay, `patchnotes:scan:${Math.floor(Date.now() / 1000) + delay}`);
            recordJobRun('patchnotes-scan', { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { updated, total, errors } });
        } catch (err) {
            recordJobRun('patchnotes-scan', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    const initialDelay = computeNextScanDelaySeconds();
    await scheduleSingleton(queue, 'patchnotes:scan', {}, 0, `patchnotes:scan:init:${Math.floor(now.getTime() / 1000)}`);
    await scheduleSingleton(queue, 'patchnotes:scan', {}, initialDelay, `patchnotes:scan:next:${Math.floor((now.getTime() / 1000) + initialDelay)}`);
    log.info({ initialDelaySeconds: initialDelay }, 'Scheduled patch notes scan job');
}
