import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { computeExponentialBackoff, computeNextDailyRunDelaySeconds, formatDateKey, scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import { sendChannelMessage } from '../utils/discord.js';
import { recordJobRun } from './status.js';

interface BirthdayRecord {
    userId: string;
    guildId: string;
    channelId: string;
    day: number;
    month: number;
    year?: number;
}

/**
 * Compute seconds until the next 09:00 (server local time).
 * Ensures a minimum delay of 1 second to avoid immediate re-run.
 */
export function computeNextRunDelaySeconds(now: Date = new Date()): number {
    return computeNextDailyRunDelaySeconds(9, now);
}

/**
 * Exponential backoff in seconds for retry attempts.
 * attempt=1 -> base; doubles each time; capped at max.
 */
export function computeBirthdayRetryBackoffSeconds(attempt: number, base = 60, max = 15 * 60): number {
    return computeExponentialBackoff(attempt, base, max);
}

async function processBirthdaysForDate(runDate: Date, force: boolean, log = getLogger({ name: 'api:jobs:birthdays' })): Promise<{ processed: number; failures: Array<{ eventId: string; userId: string; guildId: string; channelId: string }> }> {
    const cm = getConfigManager();
    const all = await cm.birthdayManager.getAllPlain() as unknown as BirthdayRecord[];
    const todayKey = formatDateKey(runDate);

    let processed = 0;
    const failures: Array<{ eventId: string; userId: string; guildId: string; channelId: string }> = [];

    for (const b of all) {
        if (!cm.birthdayManager.isBirthdayToday(b, runDate)) continue;
        const eventId = `${b.guildId}:${b.userId}:${todayKey}`;
        try {
            if (!force) {
                const { created } = await cm.notificationsManager.recordIfNew({ provider: 'birthday', eventId, guildId: b.guildId, channelId: b.channelId });
                if (!created) {
                    log.debug({ eventId }, 'Birthday already processed today; skipping');
                    continue;
                }
            } else {
                log.warn({ eventId }, 'Force enabled — bypassing idempotency and sending birthday again');
            }

            const currentYear = runDate.getFullYear();
            const ageText = b.year ? ` (turning ${currentYear - b.year})` : '';
            const content = `🎉 Happy birthday <@${b.userId}>${ageText}!`;
            const res = await sendChannelMessage(b.channelId, content);
            if (res && typeof (res as any).id === 'string') {
                await cm.notificationsManager.setMessageMeta('birthday', eventId, { guildId: b.guildId, channelId: b.channelId, messageId: (res as any).id });
                processed += 1;
                log.info({ eventId, messageId: (res as any).id, channelId: b.channelId }, 'Birthday message sent');
            } else {
                failures.push({ eventId, userId: b.userId, guildId: b.guildId, channelId: b.channelId });
                log.warn({ eventId, channelId: b.channelId }, 'Birthday message send returned no id; will retry');
            }
        } catch (err) {
            failures.push({ eventId, userId: b.userId, guildId: b.guildId, channelId: b.channelId });
            log.error({ err, eventId }, 'Failed to process birthday — will retry');
        }
    }
    return { processed, failures };
}

/**
 * Run a single birthdays processing pass without scheduling.
 * Exported for testability.
 */
export async function runBirthdaysOnce(date: Date, opts?: { force?: boolean }): Promise<number> {
    const log = getLogger({ name: 'api:jobs:birthdays' });
    const { processed } = await processBirthdaysForDate(date, opts?.force === true, log);
    recordJobRun('birthdays', { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), ok: true, meta: { processed, date: date.toISOString(), force: opts?.force === true } });
    return processed;
}

/**
 * Register the birthdays job handler and schedule the next run.
 */
export async function registerBirthdaysJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:birthdays' });

    // Daily/main handler
    queue.on<{ date?: string; force?: boolean }>('birthdays:run', async (job) => {
        const d = job.data?.date ? new Date(job.data.date) : new Date();
        const force = job.data?.force === true;
        const startedAt = new Date().toISOString();
        try {
            const { processed, failures } = await processBirthdaysForDate(d, force, log);
            // Schedule retries for failures
            for (const f of failures) {
                const delay = computeBirthdayRetryBackoffSeconds(1);
                const key = `birthdays:retry:${f.eventId}:1`;
                await scheduleSingleton(queue, 'birthdays:retry', { eventId: f.eventId, attempt: 1 }, delay, key);
            }
            // Self-schedule the next run (singleton per date to avoid duplicates)
            const delay = computeNextRunDelaySeconds();
            const nextRunAt = new Date(Date.now() + delay * 1000);
            const nextKey = `birthdays:next:${formatDateKey(nextRunAt)}`;
            await scheduleSingleton(queue, 'birthdays:run', { date: undefined }, delay, nextKey);
            recordJobRun('birthdays', { startedAt, finishedAt: new Date().toISOString(), ok: failures.length === 0, meta: { processed, failures: failures.length, date: d.toISOString(), force } });
        } catch (err) {
            recordJobRun('birthdays', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error', meta: { date: d.toISOString(), force } });
        } finally {
            await job.done();
        }
    });

    // Retry handler for single event
    queue.on<{ eventId: string; attempt?: number }>('birthdays:retry', async (job) => {
        const startedAt = new Date().toISOString();
        const eventId = job.data?.eventId;
        const attempt = Math.max(1, Number(job.data?.attempt ?? 1));
        const MAX_ATTEMPTS = 3;
        try {
            // eventId format: guildId:userId:YYYY-MM-DD
            const parts = typeof eventId === 'string' ? eventId.split(':') : [];
            const guildId = parts[0] || '';
            const userId = parts[1] || '';
            // Try to find channel from Notification
            const cm = getConfigManager();
            const notif = await cm.notificationsManager.getOnePlain({ provider: 'birthday', eventId } as any);
            const channelId = (notif && (notif as any).channelId) ? String((notif as any).channelId) : '';
            // Build content (omit age on retry to avoid requiring year)
            const content = `🎉 Happy birthday <@${userId}>!`;
            let ok = false;
            if (channelId) {
                const res = await sendChannelMessage(channelId, content);
                if (res && typeof (res as any).id === 'string') {
                    await cm.notificationsManager.setMessageMeta('birthday', eventId, { guildId, channelId, messageId: (res as any).id });
                    ok = true;
                }
            }
            if (!ok) {
                if (attempt < MAX_ATTEMPTS) {
                    const delay = computeBirthdayRetryBackoffSeconds(attempt + 1);
                    const key = `birthdays:retry:${eventId}:${attempt + 1}`;
                    await scheduleSingleton(queue, 'birthdays:retry', { eventId, attempt: attempt + 1 }, delay, key);
                }
                recordJobRun('birthdays:retry', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: 'Send failed', meta: { eventId, attempt } });
            } else {
                recordJobRun('birthdays:retry', { startedAt, finishedAt: new Date().toISOString(), ok: true, meta: { eventId, attempt } });
            }
        } catch (err) {
            // Attempt to reschedule if attempts left
            const MAX_ATTEMPTS = 3;
            if (attempt < MAX_ATTEMPTS && typeof eventId === 'string') {
                const delay = computeBirthdayRetryBackoffSeconds(attempt + 1);
                const key = `birthdays:retry:${eventId}:${attempt + 1}`;
                await job.done();
                await scheduleSingleton(queue, 'birthdays:retry', { eventId, attempt: attempt + 1 }, delay, key);
                recordJobRun('birthdays:retry', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error', meta: { eventId, attempt } });
                return;
            }
            recordJobRun('birthdays:retry', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error', meta: { eventId, attempt } });
        } finally {
            await job.done();
        }
    });

    // Schedule initial run for NEXT 09:00 (singleton per date)
    const initialDelay = computeNextRunDelaySeconds(now);
    const initialNextAt = new Date(now.getTime() + initialDelay * 1000);
    const initialKey = `birthdays:init:${formatDateKey(initialNextAt)}`;
    const id = await scheduleSingleton(queue, 'birthdays:run', { date: undefined }, initialDelay, initialKey);
    log.info({ initialDelaySeconds: initialDelay, jobId: id }, 'Scheduled birthdays job for next 09:00');

    // Also schedule an immediate catch-up run (idempotent per day)
    const catchupKey = `birthdays:catchup:${formatDateKey(now)}`;
    const immediateId = await scheduleSingleton(queue, 'birthdays:run', { date: now.toISOString() }, 0, catchupKey);
    log.info({ jobId: immediateId }, 'Scheduled immediate birthdays catch-up run');
}
