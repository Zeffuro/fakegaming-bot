import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton, computeNextMinuteBoundaryDelaySeconds, formatMinuteKey, computeBackoffWithNearWindow } from '@zeffuro/fakegaming-common/jobs';
import { sendDirectMessage } from '../utils/discord.js';
import { formatElapsed, getNextRecurringReminderTimestamp, parseTimespan, type ReminderRecurrenceRule, type ReminderRecurrenceUnit } from '@zeffuro/fakegaming-common/utils';
import { recordJobRun } from './status.js';

interface ReminderPlain {
    id: string;
    userId: string;
    message: string;
    timespan?: string | null;
    timestamp: number | string; // ms epoch
    completed?: boolean | number | string | null;
    recurrenceUnit?: string | null;
    recurrenceInterval?: number | string | null;
    recurrenceTimezone?: string | null;
    lastTriggeredAt?: number | string | null;
}

/**
 * Compute seconds until the start of the next minute, min 5 seconds.
 */
export function computeNextReminderRunDelaySeconds(now: Date = new Date()): number {
    return computeNextMinuteBoundaryDelaySeconds(now, 5);
}

/**
 * Compute exponential backoff for reminders using existing timestamp as a proxy for previous delay.
 * If current timestamp is in the past (or within base), set to base; otherwise double current delay, capped.
 */
export function computeReminderRetryBackoffSeconds(now: Date, currentTimestampMs: number, base = 60, cap = 10 * 60): number {
    const nowMs = now.getTime();
    const currentDelaySeconds = Math.max(0, Math.floor((currentTimestampMs - nowMs) / 1000));
    return computeBackoffWithNearWindow(currentDelaySeconds, base, cap, 2);
}

async function processDueReminders(now: Date, log = getLogger({ name: 'api:jobs:reminders' })): Promise<{ processed: number; errors: number }>{
    const cm = getConfigManager();
    const all = await cm.reminderManager.getAllPlain() as unknown as ReminderPlain[];
    const nowMs = now.getTime();
    const due = all.filter((r) => isDueReminder(r, nowMs));

    let processed = 0;
    let errors = 0;

    for (const r of due) {
        const timestamp = normalizeTimestamp(r.timestamp);
        if (timestamp === null) continue;

        try {
            const baseMs = timestamp - getReminderTimespanMs(r.timespan);
            const elapsed = formatElapsed(Math.max(0, nowMs - baseMs));
            const content = `⏰ Reminder: ${r.message}\n(set ${elapsed})`;
            const sent = await sendDirectMessage(r.userId, content);
            if (sent) {
                const nextTimestamp = getNextRecurringTimestamp(r, timestamp, nowMs);
                if (nextTimestamp !== null) {
                    await cm.reminderManager.rescheduleRecurringReminder(r.id, nextTimestamp, nowMs);
                    processed += 1;
                    log.info({ id: r.id, userId: r.userId, nextTimestamp }, 'Recurring reminder sent and rescheduled');
                    continue;
                }

                await cm.reminderManager.removeReminder(r.id);
                processed += 1;
                log.info({ id: r.id, userId: r.userId }, 'Reminder sent and removed');
            } else {
                // Push timestamp into the future with exponential backoff
                const delay = computeReminderRetryBackoffSeconds(now, timestamp);
                const nextTs = nowMs + delay * 1000;
                await cm.reminderManager.updatePlain({ id: r.id, timestamp: nextTs } as any, { id: r.id } as any);
                errors += 1;
                log.warn({ id: r.id, userId: r.userId, delay }, 'Failed to send reminder; scheduled retry');
            }
        } catch (err) {
            // On error, apply backoff similarly
            const delay = computeReminderRetryBackoffSeconds(now, timestamp);
            const nextTs = nowMs + delay * 1000;
            try {
                await cm.reminderManager.updatePlain({ id: r.id, timestamp: nextTs } as any, { id: r.id } as any);
            } catch {
                // ignore secondary failure to update
            }
            errors += 1;
            log.error({ err, id: r.id, userId: r.userId, delay }, 'Error processing reminder; scheduled retry');
        }
    }

    return { processed, errors };
}

function isDueReminder(reminder: ReminderPlain, nowMs: number): boolean {
    if (isReminderPaused(reminder.completed)) return false;
    const timestamp = normalizeTimestamp(reminder.timestamp);
    return timestamp !== null && timestamp <= nowMs;
}

function isReminderPaused(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function normalizeTimestamp(value: number | string): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getNextRecurringTimestamp(reminder: ReminderPlain, previousTimestamp: number, nowMs: number): number | null {
    const unit = normalizeRecurrenceUnit(reminder.recurrenceUnit);
    const interval = normalizePositiveInteger(reminder.recurrenceInterval);
    const timezone = reminder.recurrenceTimezone?.trim();
    if (!unit || !interval || !timezone) return null;

    const rule: ReminderRecurrenceRule = { unit, interval, timezone };
    return getNextRecurringReminderTimestamp({
        rule,
        previousTimestamp,
        afterTimestamp: nowMs,
    });
}

function normalizeRecurrenceUnit(value: string | null | undefined): ReminderRecurrenceUnit | null {
    if (value === 'day' || value === 'week' || value === 'month') return value;
    return null;
}

function normalizePositiveInteger(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getReminderTimespanMs(timespan: string | null | undefined): number {
    if (!timespan) return 0;

    try {
        return parseTimespan(timespan) ?? 0;
    } catch {
        return 0;
    }
}

/**
 * Register the reminders job handler and schedule it to run every minute.
 */
export async function registerRemindersJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:reminders' });

    queue.on('reminders:run', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const { processed, errors } = await processDueReminders(new Date());
            // Self-schedule next minute boundary with idempotency key
            const delay = computeNextReminderRunDelaySeconds();
            const nextAt = new Date(Date.now() + delay * 1000);
            const key = `reminders:next:${formatMinuteKey(nextAt)}`;
            await scheduleSingleton(queue, 'reminders:run', {}, delay, key);
            recordJobRun('reminders', { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { processed, errors } });
        } catch (err) {
            recordJobRun('reminders', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    // Schedule initial pass at next minute, plus an immediate pass
    const initialDelay = computeNextReminderRunDelaySeconds(now);
    const initialAt = new Date(now.getTime() + initialDelay * 1000);
    const initKey = `reminders:init:${formatMinuteKey(initialAt)}`;
    await scheduleSingleton(queue, 'reminders:run', {}, initialDelay, initKey);
    await scheduleSingleton(queue, 'reminders:run', {}, 0, `reminders:catchup:${formatMinuteKey(now)}`);
    log.info({ initialDelaySeconds: initialDelay }, 'Scheduled reminders job');
}
