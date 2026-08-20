import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import type { ReminderRecurrenceUnit } from '@zeffuro/fakegaming-common/utils';
import type { SupportedOutputLocale } from '../../../core/localization.js';

export interface ReminderCopy {
    notFound: string;
    pendingNotFound: string;
    deleted: (id: string, message: string) => string;
    recurringOnlyPause: string;
    recurringOnlyResume: string;
    alreadyPaused: (id: string) => string;
    alreadyActive: (id: string) => string;
    paused: (id: string, message: string) => string;
    resumed: (id: string, message: string, nextRun: string) => string;
    snoozed: (id: string, timestamp: number) => string;
    invalidTimespan: string;
    invalidSnooze: string;
    invalidRepeat: string;
    none: string;
    title: string;
    more: (count: number) => string;
    set: (timespan: string, message: string, timestamp: number, repeat: string) => string;
    repeat: (interval: number, unit: ReminderRecurrenceUnit, timezone: string) => string;
    invalidTimezone: string;
    timezoneSet: (timezone: string) => string;
    serverOnly: string;
    followUpMessage: (url: string) => string;
    oneHourSet: (timestamp: number) => string;
}

const en: ReminderCopy = {
    notFound: 'Reminder not found. Use `/reminders` to see your reminders.', pendingNotFound: 'Reminder not found. Use `/reminders` to see your pending reminders.',
    deleted: (id, message) => `Deleted reminder \`${id}\`: ${message}`, recurringOnlyPause: 'Only recurring reminders can be paused.', recurringOnlyResume: 'Only recurring reminders can be resumed.',
    alreadyPaused: id => `Reminder \`${id}\` is already paused.`, alreadyActive: id => `Reminder \`${id}\` is already active.`,
    paused: (id, message) => `Paused recurring reminder \`${id}\`: ${message}`, resumed: (id, message, nextRun) => `Resumed recurring reminder \`${id}\`: ${message}.${nextRun}`,
    snoozed: (id, timestamp) => `Snoozed reminder \`${id}\` until <t:${timestamp}:F> (<t:${timestamp}:R>).`,
    invalidTimespan: 'Invalid timespan format. Use e.g., 1h, 30m, 2h30m, 90s.', invalidSnooze: 'Invalid timespan format. Use e.g. 10m, 1h, or 2d.',
    invalidRepeat: 'Invalid repeat rule. Use daily, weekly, monthly, every 2 weeks, or 3mo with a valid timezone.',
    none: 'You have no active or paused reminders.', title: 'Your reminders:', more: count => `\n...and ${count} more.`,
    set: (timespan, message, timestamp, repeat) => `I'll remind you in ${timespan}: "${message}" (at <t:${timestamp}:R>).${repeat}`,
    repeat: (interval, unit, timezone) => ` Repeats ${interval === 1 ? `every ${unit}` : `every ${interval} ${unit}s`} in ${timezone}.`,
    invalidTimezone: 'Invalid timezone. Please use a valid IANA timezone (e.g., Europe/Berlin) or GMT offset.', timezoneSet: timezone => `Timezone set to \`${timezone}\`.`,
    serverOnly: 'Message reminders only work in a server.', followUpMessage: url => `Follow up on this message: ${url}`,
    oneHourSet: timestamp => `Reminder set for <t:${timestamp}:R>.`,
};

const nl: ReminderCopy = {
    notFound: 'Herinnering niet gevonden. Gebruik `/herinneringen` om je herinneringen te bekijken.', pendingNotFound: 'Herinnering niet gevonden. Gebruik `/herinneringen` om je openstaande herinneringen te bekijken.',
    deleted: (id, message) => `Herinnering \`${id}\` verwijderd: ${message}`, recurringOnlyPause: 'Alleen herhalende herinneringen kunnen worden gepauzeerd.', recurringOnlyResume: 'Alleen herhalende herinneringen kunnen worden hervat.',
    alreadyPaused: id => `Herinnering \`${id}\` is al gepauzeerd.`, alreadyActive: id => `Herinnering \`${id}\` is al actief.`,
    paused: (id, message) => `Herhalende herinnering \`${id}\` gepauzeerd: ${message}`, resumed: (id, message, nextRun) => `Herhalende herinnering \`${id}\` hervat: ${message}.${nextRun}`,
    snoozed: (id, timestamp) => `Herinnering \`${id}\` uitgesteld tot <t:${timestamp}:F> (<t:${timestamp}:R>).`,
    invalidTimespan: 'Ongeldige tijdsduur. Gebruik bijvoorbeeld 1h, 30m, 2h30m of 90s.', invalidSnooze: 'Ongeldige tijdsduur. Gebruik bijvoorbeeld 10m, 1h of 2d.',
    invalidRepeat: 'Ongeldige herhaling. Gebruik dagelijks, wekelijks, maandelijks, elke 2 weken of 3mo met een geldige tijdzone.',
    none: 'Je hebt geen actieve of gepauzeerde herinneringen.', title: 'Je herinneringen:', more: count => `\n...en nog ${count}.`,
    set: (timespan, message, timestamp, repeat) => `Ik herinner je over ${timespan} aan: "${message}" (om <t:${timestamp}:R>).${repeat}`,
    repeat: (interval, unit, timezone) => ` Wordt ${interval === 1 ? `elke ${dutchUnit(unit, 1)}` : `elke ${interval} ${dutchUnit(unit, interval)}`} herhaald in ${timezone}.`,
    invalidTimezone: 'Ongeldige tijdzone. Gebruik een geldige IANA-tijdzone (bijv. Europe/Berlin) of GMT-afwijking.', timezoneSet: timezone => `Tijdzone ingesteld op \`${timezone}\`.`,
    serverOnly: 'Berichtherinneringen werken alleen op een server.', followUpMessage: url => `Kom terug op dit bericht: ${url}`,
    oneHourSet: timestamp => `Herinnering ingesteld voor <t:${timestamp}:R>.`,
};

function dutchUnit(unit: ReminderRecurrenceUnit, interval: number): string {
    const values = {
        day: interval === 1 ? 'dag' : 'dagen',
        week: interval === 1 ? 'week' : 'weken',
        month: interval === 1 ? 'maand' : 'maanden',
    } as const;
    return values[unit];
}

export function getReminderCopy(locale: SupportedOutputLocale): ReminderCopy {
    return resolveLocaleValue(locale, { en, nl } satisfies OutputLocaleValues<ReminderCopy>);
}
