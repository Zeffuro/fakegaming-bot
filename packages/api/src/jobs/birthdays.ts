import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
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

function formatDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Compute seconds until the next 09:00 (server local time).
 * Ensures a minimum delay of 1 second to avoid immediate re-run.
 */
export function computeNextRunDelaySeconds(now: Date = new Date()): number {
    const targetHour = 9; // 09:00 server local time
    const next = new Date(now.getTime());
    next.setSeconds(0, 0);
    if (now.getHours() >= targetHour) {
        // schedule for next day 09:00
        next.setDate(next.getDate() + 1);
    }
    next.setHours(targetHour, 0, 0, 0);
    const diffMs = next.getTime() - now.getTime();
    return Math.max(1, Math.floor(diffMs / 1000));
}

async function processBirthdaysForDate(runDate: Date, force: boolean, log = getLogger({ name: 'api:jobs:birthdays' })): Promise<number> {
    const cm = getConfigManager();
    const all = await cm.birthdayManager.getAllPlain() as unknown as BirthdayRecord[];
    const todayKey = formatDateKey(runDate);

    let processed = 0;
    for (const b of all) {
        if (!cm.birthdayManager.isBirthdayToday(b, runDate)) continue;
        const eventId = `${b.guildId}:${b.userId}:${todayKey}`;
        try {
            if (!force) {
                const { created } = await cm.notificationsManager.recordIfNew({ provider: 'birthday', eventId, guildId: b.guildId, channelId: b.channelId });
                if (!created) {
                    const _skip: unknown = null;
                    // Prefix _ to satisfy lint for unused vars if we add more context later
                    void _skip;
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
                // Persist message meta regardless of force to aid admin/status views
                await cm.notificationsManager.setMessageMeta('birthday', eventId, { guildId: b.guildId, channelId: b.channelId, messageId: (res as any).id });
                processed += 1;
                log.info({ eventId, messageId: (res as any).id, channelId: b.channelId }, 'Birthday message sent');
            } else {
                log.warn({ eventId, channelId: b.channelId }, 'Birthday message send returned no id');
            }
        } catch (err) {
            log.error({ err, eventId }, 'Failed to process birthday');
        }
    }
    return processed;
}

/**
 * Run a single birthdays processing pass without scheduling.
 * Exported for testability.
 */
export async function runBirthdaysOnce(date: Date, opts?: { force?: boolean }): Promise<number> {
    const log = getLogger({ name: 'api:jobs:birthdays' });
    const processed = await processBirthdaysForDate(date, opts?.force === true, log);
    recordJobRun('birthdays', { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), ok: true, meta: { processed, date: date.toISOString(), force: opts?.force === true } });
    return processed;
}

/**
 * Register the birthdays job handler and schedule the next run.
 */
export async function registerBirthdaysJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:birthdays' });

    queue.on<{ date?: string; force?: boolean }>('birthdays:run', async (job) => {
        const d = job.data?.date ? new Date(job.data.date) : new Date();
        const force = job.data?.force === true;
        const startedAt = new Date().toISOString();
        try {
            const processed = await processBirthdaysForDate(d, force, log);
            // Self-schedule the next run (singleton per date to avoid duplicates)
            const delay = computeNextRunDelaySeconds();
            const nextRunAt = new Date(Date.now() + delay * 1000);
            const nextKey = `birthdays:next:${formatDateKey(nextRunAt)}`;
            await queue.schedule('birthdays:run', { date: undefined }, { startAfterSeconds: delay, idempotencyKey: nextKey });
            recordJobRun('birthdays', { startedAt, finishedAt: new Date().toISOString(), ok: true, meta: { processed, date: d.toISOString(), force } });
        } catch (err) {
            recordJobRun('birthdays', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error', meta: { date: d.toISOString(), force } });
        } finally {
            await job.done();
        }
    });

    // Schedule initial run for NEXT 09:00 (singleton per date)
    const initialDelay = computeNextRunDelaySeconds(now);
    const initialNextAt = new Date(now.getTime() + initialDelay * 1000);
    const initialKey = `birthdays:init:${formatDateKey(initialNextAt)}`;
    const id = await queue.schedule('birthdays:run', { date: undefined }, { startAfterSeconds: initialDelay, idempotencyKey: initialKey });
    log.info({ initialDelaySeconds: initialDelay, jobId: id }, 'Scheduled birthdays job for next 09:00');

    // Also schedule an immediate catch-up run (idempotent per day)
    const catchupKey = `birthdays:catchup:${formatDateKey(now)}`;
    const immediateId = await queue.schedule('birthdays:run', { date: now.toISOString() }, { startAfterSeconds: 0, idempotencyKey: catchupKey });
    log.info({ jobId: immediateId }, 'Scheduled immediate birthdays catch-up run');
}
