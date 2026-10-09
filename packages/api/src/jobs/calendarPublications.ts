import { formatMinuteKey, scheduleSingleton, type JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { processCalendarPublications } from '../calendarPublishing/processor.js';
import { recordJobRun } from './status.js';

export async function registerCalendarPublicationJobs(queue: JobQueue): Promise<void> {
    queue.on('calendar-publications:run', async job => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processCalendarPublications();
            recordJobRun('calendar-publications', { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: result });
        } catch {
            recordJobRun('calendar-publications', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: 'Calendar publication processing failed' });
        } finally {
            try { await scheduleSingleton(queue, 'calendar-publications:run', {}, 60, `calendar-publications:${formatMinuteKey(new Date(Date.now() + 60_000))}`); }
            finally { await job.done(); }
        }
    });
    await scheduleSingleton(queue, 'calendar-publications:run', {}, 10, `calendar-publications:init:${formatMinuteKey(new Date())}`);
}
