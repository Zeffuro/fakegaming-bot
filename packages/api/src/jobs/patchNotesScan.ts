import {getLogger} from '@zeffuro/fakegaming-common';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import type {JobQueue} from '@zeffuro/fakegaming-common/jobs';
import {getDefaultPatchNoteFetchers} from '@zeffuro/fakegaming-common/patchnotes';
import {registerRecurringPollingJob} from './recurringPollingJob.js';

async function processPatchNotesScan(log = getLogger({ name: 'api:jobs:patchnotes:scan' })): Promise<{
    errors: number;
    historyPrunedRows: number;
    historyTruncated: number;
    total: number;
    updated: number;
}> {
    const cm = getConfigManager();
    const fetchers = getDefaultPatchNoteFetchers();
    let updated = 0;
    let errors = 0;
    let historyPrunedRows = 0;
    let historyTruncated = 0;

    for (const fetcher of fetchers) {
        try {
            const latestStored = await cm.patchNotesManager.getLatestPatch(fetcher.game);
            const latestPatch = await fetcher.fetchLatestPatchNote(latestStored?.version ?? undefined);
            if (!latestPatch) continue;
            const historyResult = await cm.patchNotesManager.setLatestPatch({ ...latestPatch, game: fetcher.game } as any);
            historyPrunedRows += historyResult?.prunedRows ?? 0;
            if (historyResult?.contentTruncated) historyTruncated += 1;
            updated += 1;
        } catch (err) {
            errors += 1;
            log.error({ err, game: fetcher.game }, 'Failed to scan patch notes');
        }
    }

    return { updated, total: fetchers.length, errors, historyPrunedRows, historyTruncated };
}

export async function registerPatchNotesScanJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    await registerRecurringPollingJob({
        provider: 'patchnotes-scan',
        jobName: 'patchnotes:scan',
        queue,
        now,
        intervalSeconds: 20 * 60,
        jitterSeconds: 5 * 60,
        run: processPatchNotesScan,
    });
}
