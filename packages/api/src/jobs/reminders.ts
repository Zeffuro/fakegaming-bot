import { DEFAULT_OUTPUT_LOCALE, getLogger, getOutputLocaleMetadata } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton, computeNextMinuteBoundaryDelaySeconds, formatMinuteKey, computeBackoffWithNearWindow } from '@zeffuro/fakegaming-common/jobs';
import { sendDirectMessagePayloadResult } from '../utils/discord.js';
import { buildReminderDeliveryPayload } from './reminderDelivery.js';
import { prepareProductivityNotification } from './productivityReminders.js';
import { getNextRecurringReminderTimestamp, parseTimespan, type ReminderRecurrenceRule, type ReminderRecurrenceUnit } from '@zeffuro/fakegaming-common/utils';
import { recordJobRun } from './status.js';
import { apiText, resolveUserOutputLocale } from '../localization/locale.js';
import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';

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

export function buildReminderContent(
    message: string,
    elapsed: string,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): string {
    return `\u23f0 ${apiText(locale, 'reminder', { message, elapsed })}`;
}

export function formatReminderElapsed(ms: number, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    const seconds = Math.max(0, Math.floor(ms / 1_000));
    const [value, unit] = seconds >= 86_400
        ? [Math.floor(seconds / 86_400), 'day'] as const
        : seconds >= 3_600
            ? [Math.floor(seconds / 3_600), 'hour'] as const
            : seconds >= 60
                ? [Math.floor(seconds / 60), 'minute'] as const
                : [seconds, 'second'] as const;
    return new Intl.RelativeTimeFormat(
        getOutputLocaleMetadata(locale).formatTag,
        { numeric: 'always' },
    ).format(-value, unit);
}

async function processDueReminders(now: Date, log = getLogger({ name: 'api:jobs:reminders' })): Promise<{ processed: number; errors: number }>{
    const cm = getConfigManager();
    await cm.reminderInteractionManager.prune();
    const all = await cm.reminderManager.getAllPlain() as unknown as ReminderPlain[];
    const nowMs = now.getTime();
    const due = all.filter((r) => isDueReminder(r, nowMs));

    let processed = 0;
    let errors = 0;

    for (const r of due) {
        const timestamp = normalizeTimestamp(r.timestamp);
        if (timestamp === null) continue;
        let sendClaimed = false;

        try {
            const personal = await prepareProductivityNotification(r);
            if (!personal) {
                await cm.reminderManager.removeReminder(r.id);
                continue;
            }
            const baseMs = timestamp - getReminderTimespanMs(r.timespan);
            const locale = await resolveUserOutputLocale(r.userId);
            const elapsed = formatReminderElapsed(Math.max(0, nowMs - baseMs), locale);
            const delivery = await cm.reminderInteractionManager.prepareDelivery(r, timestamp);
            if (delivery.status === 'sending') {
                if (Number(delivery.attemptedAt) > nowMs - 5 * 60_000) continue;
                await cm.reminderInteractionManager.markUncertain(delivery.id);
                log.warn({ id: r.id, deliveryId: delivery.id }, 'Interrupted reminder send outcome unknown; not replaying');
                errors += 1;
            } else if (delivery.status === 'pending') {
                sendClaimed = await cm.reminderInteractionManager.claimDelivery(delivery.id, timestamp);
                if (!sendClaimed) continue;
                const result = await sendDirectMessagePayloadResult(
                    r.userId, buildReminderDeliveryPayload(delivery.id, buildReminderContent(personal.content, elapsed, locale), locale, personal),
                );
                if (result.status === 'rejected') {
                    const delay = computeReminderRetryBackoffSeconds(now, timestamp);
                    await cm.reminderInteractionManager.releaseDelivery(delivery.id, nowMs + delay * 1000);
                    sendClaimed = false;
                    errors += 1;
                    log.warn({ id: r.id, userId: r.userId, delay }, 'Reminder rejected by Discord; scheduled retry');
                    continue;
                }
                if (result.status === 'sent' && typeof result.message.id === 'string' && typeof result.message.channel_id === 'string') {
                    await cm.reminderInteractionManager.markDelivered(delivery.id, result.message.id, result.message.channel_id);
                } else {
                    await cm.reminderInteractionManager.markUncertain(delivery.id);
                    errors += 1;
                    log.warn({ id: r.id, deliveryId: delivery.id }, 'Reminder send outcome unknown; not replaying');
                }
            }
            sendClaimed = true;
            const nextTimestamp = getNextRecurringTimestamp(r, Number(delivery.scheduledAt), nowMs);
            await cm.reminderInteractionManager.finalizeDelivery(delivery.id, nextTimestamp, nowMs);
            if (nextTimestamp !== null) {
                processed += 1;
                log.info({ id: r.id, userId: r.userId, nextTimestamp }, 'Reminder occurrence finalized and next recurrence scheduled');
                continue;
            }
            processed += 1;
            log.info({ id: r.id, userId: r.userId }, 'Reminder occurrence finalized');
        } catch (err) {
            if (sendClaimed) {
                errors += 1;
                log.error({ err, id: r.id }, 'Reminder send claimed; retaining occurrence for recovery without replay');
                continue;
            }
            // On error, apply backoff similarly
            const delay = computeReminderRetryBackoffSeconds(now, timestamp);
            const nextTs = nowMs + delay * 1000;
            try {
                await cm.reminderManager.updatePlain({ id: r.id, timestamp: nextTs } as never, {
                    id: r.id, userId: r.userId, timestamp, completed: r.completed ?? null,
                } as never);
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
            recordJobRun('reminders', { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { processed, errors } });
        } catch (err) {
            recordJobRun('reminders', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            try {
                const delay = computeNextReminderRunDelaySeconds();
                const nextAt = new Date(Date.now() + delay * 1000);
                await scheduleSingleton(queue, 'reminders:run', {}, delay, `reminders:next:${formatMinuteKey(nextAt)}`);
            } finally {
                await job.done();
            }
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
