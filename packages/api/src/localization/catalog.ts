import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import enErrors from './messages/en/errors.json' with { type: 'json' };
import enNotifications from './messages/en/notifications.json' with { type: 'json' };
import enTemplates from './messages/en/templates.json' with { type: 'json' };
import enValidation from './messages/en/validation.json' with { type: 'json' };
import nlErrors from './messages/nl/errors.json' with { type: 'json' };
import nlNotifications from './messages/nl/notifications.json' with { type: 'json' };
import nlTemplates from './messages/nl/templates.json' with { type: 'json' };
import nlValidation from './messages/nl/validation.json' with { type: 'json' };

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
    },
    nl: {
        errors: nlErrors,
        notifications: nlNotifications,
        validation: nlValidation,
    },
} as const satisfies Readonly<Record<SupportedOutputLocale, Readonly<Record<string, Readonly<Record<string, string>>>>>>;

export const API_COPY_EN = {
    ...API_MESSAGE_DOMAINS.en.errors,
    ...API_MESSAGE_DOMAINS.en.notifications,
    ...API_TEMPLATE_COPY.en.messages,
    ...API_MESSAGE_DOMAINS.en.validation,
} as const;

export type ApiCopyKey = keyof typeof API_COPY_EN;

export const API_COPY_NL = {
    ...API_MESSAGE_DOMAINS.nl.errors,
    ...API_MESSAGE_DOMAINS.nl.notifications,
    ...API_TEMPLATE_COPY.nl.messages,
    ...API_MESSAGE_DOMAINS.nl.validation,
} as const satisfies Readonly<Record<ApiCopyKey, string>>;

// Compatibility view for existing route and job call sites. JSON files above are the source of truth.
export const API_COPY: Readonly<Record<SupportedOutputLocale, Readonly<Record<ApiCopyKey, string>>>> = {
    en: API_COPY_EN,
    nl: API_COPY_NL,
};
