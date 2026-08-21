import { createTranslator } from "next-intl";
import type { DashboardLocale, DashboardLocaleValues } from "./localeStore";

import adminEn from "../../messages/en/admin.json";
import analyticsEn from "../../messages/en/analytics.json";
import animeEn from "../../messages/en/anime.json";
import birthdaysEn from "../../messages/en/birthdays.json";
import commandsEn from "../../messages/en/commands.json";
import configEn from "../../messages/en/config.json";
import coreEn from "../../messages/en/core.json";
import guildEn from "../../messages/en/guild.json";
import hooksEn from "../../messages/en/hooks.json";
import legalEn from "../../messages/en/legal.json";
import notificationsEn from "../../messages/en/notifications.json";
import patchEn from "../../messages/en/patch.json";
import permissionsEn from "../../messages/en/permissions.json";
import personalEn from "../../messages/en/personal.json";
import quotesEn from "../../messages/en/quotes.json";
import settingsEn from "../../messages/en/settings.json";

import adminNl from "../../messages/nl/admin.json";
import analyticsNl from "../../messages/nl/analytics.json";
import animeNl from "../../messages/nl/anime.json";
import birthdaysNl from "../../messages/nl/birthdays.json";
import commandsNl from "../../messages/nl/commands.json";
import configNl from "../../messages/nl/config.json";
import coreNl from "../../messages/nl/core.json";
import guildNl from "../../messages/nl/guild.json";
import hooksNl from "../../messages/nl/hooks.json";
import legalNl from "../../messages/nl/legal.json";
import notificationsNl from "../../messages/nl/notifications.json";
import patchNl from "../../messages/nl/patch.json";
import permissionsNl from "../../messages/nl/permissions.json";
import personalNl from "../../messages/nl/personal.json";
import quotesNl from "../../messages/nl/quotes.json";
import settingsNl from "../../messages/nl/settings.json";

export const englishMessages = {
    ...adminEn,
    ...analyticsEn,
    ...animeEn,
    ...birthdaysEn,
    ...commandsEn,
    ...configEn,
    ...coreEn,
    ...guildEn,
    ...hooksEn,
    ...legalEn,
    ...notificationsEn,
    ...patchEn,
    ...permissionsEn,
    ...personalEn,
    ...quotesEn,
    ...settingsEn,
} as const;

type MessageShape<T> = {
    [Key in keyof T]: T[Key] extends string ? string : MessageShape<T[Key]>;
};

export const dutchMessages = {
    ...adminNl,
    ...analyticsNl,
    ...animeNl,
    ...birthdaysNl,
    ...commandsNl,
    ...configNl,
    ...coreNl,
    ...guildNl,
    ...hooksNl,
    ...legalNl,
    ...notificationsNl,
    ...patchNl,
    ...permissionsNl,
    ...personalNl,
    ...quotesNl,
    ...settingsNl,
} as const satisfies MessageShape<typeof englishMessages>;

type NestedMessageKey<T> = {
    [Key in keyof T & string]: T[Key] extends string
        ? Key
        : T[Key] extends Record<string, unknown>
            ? `${Key}.${NestedMessageKey<T[Key]>}`
            : never;
}[keyof T & string];

export type DashboardMessageKey = NestedMessageKey<typeof englishMessages>;
export type DashboardMessages = MessageShape<typeof englishMessages>;
export type DashboardTranslator = (
    key: DashboardMessageKey,
    values?: Record<string, string | number>,
) => string;

export const dashboardLocaleNameKeys = {
    en: "language.english",
    nl: "language.dutch",
} as const satisfies DashboardLocaleValues<DashboardMessageKey>;

export const dashboardMessages: DashboardLocaleValues<DashboardMessages> = {
    en: englishMessages,
    nl: dutchMessages,
};

type IntlTranslator = (key: string, values?: Record<string, string | number>) => string;

const dashboardTranslators: DashboardLocaleValues<IntlTranslator> = {
    en: createTranslator({
        locale: "en",
        messages: englishMessages,
    }) as IntlTranslator,
    nl: createTranslator({
        locale: "nl",
        messages: dutchMessages,
    }) as IntlTranslator,
};

export function formatDashboardMessage(
    locale: DashboardLocale,
    key: DashboardMessageKey,
    values?: Record<string, string | number>,
): string {
    return dashboardTranslators[locale](key, values);
}
