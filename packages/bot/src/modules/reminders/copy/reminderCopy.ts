import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import type { ReminderRecurrenceUnit } from '@zeffuro/fakegaming-common/utils';
import { createBotTranslator, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import englishMessages from '../../../messages/en/reminders.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/reminders.json' with { type: 'json' };

export interface ReminderCopy {
    notFound: string; pendingNotFound: string; deleted: (id: string, message: string) => string;
    recurringOnlyPause: string; recurringOnlyResume: string; alreadyPaused: (id: string) => string;
    alreadyActive: (id: string) => string; paused: (id: string, message: string) => string;
    resumed: (id: string, message: string, nextRun: string) => string; snoozed: (id: string, timestamp: number) => string;
    invalidTimespan: string; invalidSnooze: string; invalidRepeat: string; none: string; title: string;
    more: (count: number) => string; set: (timespan: string, message: string, timestamp: number, repeat: string) => string;
    repeat: (interval: number, unit: ReminderRecurrenceUnit, timezone: string) => string;
    invalidTimezone: string; timezoneSet: (timezone: string) => string; serverOnly: string;
    followUpMessage: (url: string) => string; oneHourSet: (timestamp: number) => string;
}

export function getReminderCopy(locale: SupportedOutputLocale): ReminderCopy {
    const messages = resolveLocaleValue(locale, { en: englishMessages, nl: dutchMessages } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    const raw = messages as typeof englishMessages;
    const t = createBotTranslator(locale, messages);
    return {
        notFound: raw.notFound, pendingNotFound: raw.pendingNotFound, recurringOnlyPause: raw.recurringOnlyPause,
        recurringOnlyResume: raw.recurringOnlyResume, invalidTimespan: raw.invalidTimespan,
        invalidSnooze: raw.invalidSnooze, invalidRepeat: raw.invalidRepeat, none: raw.none, title: raw.title,
        invalidTimezone: raw.invalidTimezone, serverOnly: raw.serverOnly,
        deleted: (id, message) => t('deleted', { id, message }), alreadyPaused: id => t('alreadyPaused', { id }),
        alreadyActive: id => t('alreadyActive', { id }), paused: (id, message) => t('paused', { id, message }),
        resumed: (id, message, nextRun) => t('resumed', { id, message, nextRun }),
        snoozed: (id, timestamp) => t('snoozed', { id, timestamp }), more: count => t('more', { count }),
        set: (timespan, message, timestamp, repeat) => t('set', { timespan, message, timestamp, repeat }),
        repeat: (interval, unit, timezone) => t('repeat', { interval, unit, timezone }),
        timezoneSet: timezone => t('timezoneSet', { timezone }),
        followUpMessage: url => t('followUpMessage', { url }), oneHourSet: timestamp => t('oneHourSet', { timestamp }),
    };
}
