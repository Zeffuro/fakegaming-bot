import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import type { SupportedOutputLocale } from '../../../core/localization.js';

export interface ReminderLike {
    id: string;
    message: string;
    timestamp: number | string;
    completed?: boolean | number | string | null;
    recurrenceUnit?: string | null;
    recurrenceInterval?: number | string | null;
    recurrenceTimezone?: string | null;
}

export function shortReminderId(id: string): string {
    return id.slice(0, 8);
}

export function formatReminderLine(
    reminder: ReminderLike,
    index: number,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): string {
    const timestamp = typeof reminder.timestamp === 'string' ? Number(reminder.timestamp) : reminder.timestamp;
    const unix = Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
    const when = unix > 0 ? `<t:${unix}:R>` : resolveLocaleValue(locale, { en: 'unknown time', nl: 'onbekende tijd' });
    const state = isReminderPaused(reminder)
        ? resolveLocaleValue(locale, { en: ' [paused]', nl: ' [gepauzeerd]' })
        : isRecurringReminder(reminder) ? resolveLocaleValue(locale, { en: ' [active]', nl: ' [actief]' }) : '';
    const recurrence = formatReminderRecurrenceSuffix(reminder, locale);
    return `${index + 1}. \`${shortReminderId(reminder.id)}\` ${when}${recurrence}${state} - ${reminder.message}`;
}

export function resolveReminderByInput<T extends ReminderLike>(reminders: T[], input: string): T | null {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;

    const index = Number(trimmed);
    if (Number.isInteger(index) && index >= 1 && index <= reminders.length) {
        return reminders[index - 1] ?? null;
    }

    return reminders.find(reminder => reminder.id.toLowerCase() === trimmed || reminder.id.toLowerCase().startsWith(trimmed)) ?? null;
}

export function isReminderPaused(reminder: ReminderLike): boolean {
    return reminder.completed === true || reminder.completed === 1 || reminder.completed === '1';
}

export function isRecurringReminder(reminder: ReminderLike): boolean {
    return Boolean(reminder.recurrenceUnit && reminder.recurrenceInterval && reminder.recurrenceTimezone);
}

function formatReminderRecurrenceSuffix(reminder: ReminderLike, locale: SupportedOutputLocale): string {
    if (!isRecurringReminder(reminder)) return '';

    const interval = typeof reminder.recurrenceInterval === 'number'
        ? reminder.recurrenceInterval
        : Number(reminder.recurrenceInterval);
    if (!Number.isInteger(interval) || interval < 1 || !reminder.recurrenceUnit || !reminder.recurrenceTimezone) return '';

    const unit = resolveLocaleValue(locale, { en: interval === 1 ? reminder.recurrenceUnit : `${reminder.recurrenceUnit}s`, nl: dutchRecurrenceUnit(reminder.recurrenceUnit, interval) });
    const cadence = resolveLocaleValue(locale, { en: interval === 1 ? `every ${reminder.recurrenceUnit}` : `every ${interval} ${unit}`, nl: interval === 1 ? `elke ${unit}` : `elke ${interval} ${unit}` });
    return ` (${cadence}, ${reminder.recurrenceTimezone})`;
}

function dutchRecurrenceUnit(unit: string, interval: number): string {
    const singular: Record<string, string> = { minute: 'minuut', hour: 'uur', day: 'dag', week: 'week', month: 'maand', year: 'jaar' };
    const plural: Record<string, string> = { minute: 'minuten', hour: 'uur', day: 'dagen', week: 'weken', month: 'maanden', year: 'jaar' };
    return (interval === 1 ? singular[unit] : plural[unit]) ?? unit;
}
