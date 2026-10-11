import enNotificationPause from './messages/en/notificationPause.json' with { type: 'json' };
import nlNotificationPause from './messages/nl/notificationPause.json' with { type: 'json' };
import enDashboardLayout from './messages/en/dashboardLayout.json' with { type: 'json' };
import nlDashboardLayout from './messages/nl/dashboardLayout.json' with { type: 'json' };
import nlPollTemplates from './messages/nl/pollTemplates.json' with { type: 'json' };
import enPollTemplates from './messages/en/pollTemplates.json' with { type: 'json' };
import nlMorningBriefings from './messages/nl/morningBriefings.json' with { type: 'json' };
import enMorningBriefings from './messages/en/morningBriefings.json' with { type: 'json' };
import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import enErrors from './messages/en/errors.json' with { type: 'json' };
import enNotifications from './messages/en/notifications.json' with { type: 'json' };
import enTemplates from './messages/en/templates.json' with { type: 'json' };
import enValidation from './messages/en/validation.json' with { type: 'json' };
import enPersonalFollows from './messages/en/personalFollows.json' with { type: 'json' };
import enCalendar from './messages/en/calendar.json' with { type: 'json' };
import enSchedules from './messages/en/schedules.json' with { type: 'json' };
import enToday from './messages/en/today.json' with { type: 'json' };
import enChecklists from './messages/en/checklists.json' with { type: 'json' };
import enTaskEditor from './messages/en/taskEditor.json' with { type: 'json' };
import enCalendarOverlaps from './messages/en/calendarOverlaps.json' with { type: 'json' };
import nlErrors from './messages/nl/errors.json' with { type: 'json' };
import nlNotifications from './messages/nl/notifications.json' with { type: 'json' };
import nlTemplates from './messages/nl/templates.json' with { type: 'json' };
import nlValidation from './messages/nl/validation.json' with { type: 'json' };
import nlPersonalFollows from './messages/nl/personalFollows.json' with { type: 'json' };
import nlCalendar from './messages/nl/calendar.json' with { type: 'json' };
import nlSchedules from './messages/nl/schedules.json' with { type: 'json' };
import nlToday from './messages/nl/today.json' with { type: 'json' };
import nlChecklists from './messages/nl/checklists.json' with { type: 'json' };
import nlTaskEditor from './messages/nl/taskEditor.json' with { type: 'json' };
import nlCalendarOverlaps from './messages/nl/calendarOverlaps.json' with { type: 'json' };

export const API_TEMPLATE_COPY = {
    en: enTemplates,
    nl: nlTemplates,
} as const satisfies Readonly<Record<SupportedOutputLocale, {
    definitions: Readonly<Record<string, unknown>>;
    messages: Readonly<Record<string, string>>;
}>>;

export const API_MESSAGE_DOMAINS = {
    en: {
        errors: enErrors,
        notifications: enNotifications,
        validation: enValidation,
        personalFollows: enPersonalFollows,
        calendar: enCalendar,
        schedules: enSchedules,
        today: enToday,
        checklists: enChecklists,
        taskEditor: enTaskEditor,
        calendarOverlaps: enCalendarOverlaps,
        pollTemplates: enPollTemplates,
        morningBriefings: enMorningBriefings,
        dashboardLayout: enDashboardLayout,
        notificationPause: enNotificationPause,
    },
    nl: {
        errors: nlErrors,
        notifications: nlNotifications,
        validation: nlValidation,
        personalFollows: nlPersonalFollows,
        calendar: nlCalendar,
        schedules: nlSchedules,
        today: nlToday,
        checklists: nlChecklists,
        taskEditor: nlTaskEditor,
        calendarOverlaps: nlCalendarOverlaps,
        pollTemplates: nlPollTemplates,
        morningBriefings: nlMorningBriefings,
        dashboardLayout: nlDashboardLayout,
        notificationPause: nlNotificationPause,
    },
} as const satisfies Readonly<Record<SupportedOutputLocale, Readonly<Record<string, Readonly<Record<string, string>>>>>>;

export const API_COPY_EN = {
    ...API_MESSAGE_DOMAINS.en.errors,
    ...API_MESSAGE_DOMAINS.en.notifications,
    ...API_TEMPLATE_COPY.en.messages,
    ...API_MESSAGE_DOMAINS.en.validation,
    ...API_MESSAGE_DOMAINS.en.personalFollows,
    ...API_MESSAGE_DOMAINS.en.calendar,
    ...API_MESSAGE_DOMAINS.en.schedules,
    ...API_MESSAGE_DOMAINS.en.today,
    ...API_MESSAGE_DOMAINS.en.checklists,
    ...API_MESSAGE_DOMAINS.en.taskEditor,
    ...API_MESSAGE_DOMAINS.en.calendarOverlaps,
    ...API_MESSAGE_DOMAINS.en.pollTemplates,
    ...API_MESSAGE_DOMAINS.en.morningBriefings,
    ...API_MESSAGE_DOMAINS.en.dashboardLayout,
    ...API_MESSAGE_DOMAINS.en.notificationPause,
} as const;

export type ApiCopyKey = keyof typeof API_COPY_EN;

export const API_COPY_NL = {
    ...API_MESSAGE_DOMAINS.nl.errors,
    ...API_MESSAGE_DOMAINS.nl.notifications,
    ...API_TEMPLATE_COPY.nl.messages,
    ...API_MESSAGE_DOMAINS.nl.validation,
    ...API_MESSAGE_DOMAINS.nl.personalFollows,
    ...API_MESSAGE_DOMAINS.nl.calendar,
    ...API_MESSAGE_DOMAINS.nl.schedules,
    ...API_MESSAGE_DOMAINS.nl.today,
    ...API_MESSAGE_DOMAINS.nl.checklists,
    ...API_MESSAGE_DOMAINS.nl.taskEditor,
    ...API_MESSAGE_DOMAINS.nl.calendarOverlaps,
    ...API_MESSAGE_DOMAINS.nl.pollTemplates,
    ...API_MESSAGE_DOMAINS.nl.morningBriefings,
    ...API_MESSAGE_DOMAINS.nl.dashboardLayout,
    ...API_MESSAGE_DOMAINS.nl.notificationPause,
} as const satisfies Readonly<Record<ApiCopyKey, string>>;

// Compatibility view for existing route and job call sites. JSON files above are the source of truth.
export const API_COPY: Readonly<Record<SupportedOutputLocale, Readonly<Record<ApiCopyKey, string>>>> = {
    en: API_COPY_EN,
    nl: API_COPY_NL,
};
