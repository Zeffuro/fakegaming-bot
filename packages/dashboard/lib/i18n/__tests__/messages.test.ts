import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import {
    dashboardMessages,
    formatDashboardMessage,
    type DashboardMessageKey,
} from "@/lib/i18n/messages";
import { defaultDashboardLocale, nonDefaultDashboardLocales } from "@/lib/i18n/localeStore";
import type { DashboardLocale } from "@/lib/i18n/localeStore";

describe("dashboard message catalogs", () => {
    it("keeps every translated catalog in exact parity with the default", () => {
        const defaultMessages = flattenMessages(dashboardMessages[defaultDashboardLocale]);
        expect(Object.keys(defaultMessages)).toHaveLength(1876);
        for (const locale of nonDefaultDashboardLocales) {
            expect(Object.keys(flattenMessages(dashboardMessages[locale])).sort(), locale)
                .toEqual(Object.keys(defaultMessages).sort());
        }
    });

    it("has non-empty translations for every supported locale", () => {
        for (const messages of Object.values(dashboardMessages)) {
            for (const value of Object.values(flattenMessages(messages))) {
                expect(value.trim()).not.toBe("");
            }
        }
    });

    it("keeps ICU arguments in parity with the default locale", () => {
        const defaultMessages = flattenMessages(dashboardMessages[defaultDashboardLocale]);
        for (const locale of nonDefaultDashboardLocales) {
            const translatedMessages = flattenMessages(dashboardMessages[locale]);
            for (const [key, message] of Object.entries(defaultMessages)) {
                expect(placeholders(translatedMessages[key] ?? ""), `${locale}:${key}`)
                    .toEqual(placeholders(message));
            }
        }
    });

    it("formats catalog values through ICU MessageFormat", () => {
        expect(formatDashboardMessage("en", "guildDashboard.title", { guild: "Test Guild" }))
            .toBe("Test Guild Dashboard");
        expect(formatDashboardMessage("nl", "guildDashboard.title", { guild: "Test Guild" }))
            .toBe("Dashboard van Test Guild");
    });

    it("contains valid ICU messages in every locale", () => {
        for (const [locale, catalog] of Object.entries(dashboardMessages)) {
            const translator = createTranslator({
                locale: locale as DashboardLocale,
                messages: catalog,
                onError: error => { throw error; },
            }) as (key: DashboardMessageKey, values?: Record<string, string>) => string;

            for (const [key, message] of Object.entries(flattenMessages(catalog))) {
                const values = Object.fromEntries(placeholders(message).map(name => [name, "value"]));
                expect(translator(key as DashboardMessageKey, values), `${locale}:${key}`).toBeTypeOf("string");
            }
        }
    });
});

function flattenMessages(messages: object, prefix = ""): Record<string, string> {
    const flattened: Record<string, string> = {};
    for (const [key, value] of Object.entries(messages)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") flattened[path] = value;
        else if (value && typeof value === "object") Object.assign(flattened, flattenMessages(value, path));
    }
    return flattened;
}

function placeholders(message: string): string[] {
    const names: string[] = [];
    for (const match of message.matchAll(/\{([A-Za-z0-9_]+)(?:[,}])/g)) {
        const matchIndex = match.index ?? 0;
        const preceding = message.slice(0, matchIndex).match(/(?:^|[{},])\s*([A-Za-z]+|=\d+)\s*$/)?.[1];
        if (preceding && /^(?:zero|one|two|few|many|other|=\d+)$/.test(preceding)) continue;
        names.push(match[1] ?? "");
    }
    return [...new Set(names)].sort();
}
