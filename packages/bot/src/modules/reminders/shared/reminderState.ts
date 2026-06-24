import {getNextRecurringReminderTimestamp, type ReminderRecurrenceRule, type ReminderRecurrenceUnit} from '@zeffuro/fakegaming-common/utils';
import type {ReminderLike} from './reminderFormat.js';

export function getReminderRecurrenceRule(reminder: ReminderLike): ReminderRecurrenceRule | null {
    const unit = normalizeRecurrenceUnit(reminder.recurrenceUnit);
    const interval = normalizePositiveInteger(reminder.recurrenceInterval);
    const timezone = reminder.recurrenceTimezone?.trim();
    if (!unit || !interval || !timezone) return null;

    return {unit, interval, timezone};
}

export function getResumeTimestamp(reminder: ReminderLike, rule: ReminderRecurrenceRule, nowMs = Date.now()): number | undefined {
    const timestamp = Number(reminder.timestamp);
    if (!Number.isFinite(timestamp) || timestamp > nowMs) return undefined;

    return getNextRecurringReminderTimestamp({
        rule,
        previousTimestamp: timestamp,
        afterTimestamp: nowMs,
    }) ?? undefined;
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
