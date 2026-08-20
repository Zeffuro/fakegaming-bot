import { describe, expect, it } from "vitest";
import { dashboardMessages } from "@/lib/i18n/messages";
import { defaultDashboardLocale, nonDefaultDashboardLocales } from "@/lib/i18n/localeStore";

describe("dashboard message catalogs", () => {
    it("keeps every translated catalog in exact parity with the default", () => {
        const defaultMessages = dashboardMessages[defaultDashboardLocale];
        for (const locale of nonDefaultDashboardLocales) {
            expect(Object.keys(dashboardMessages[locale]).sort(), locale)
                .toEqual(Object.keys(defaultMessages).sort());
        }
    });

    it("has non-empty translations for every supported locale", () => {
        for (const messages of Object.values(dashboardMessages)) {
            for (const value of Object.values(messages)) {
                expect(value.trim()).not.toBe("");
            }
        }
    });

    it("keeps interpolation placeholders in parity with the default locale", () => {
        const defaultMessages = dashboardMessages[defaultDashboardLocale];
        for (const locale of nonDefaultDashboardLocales) {
            for (const key of Object.keys(defaultMessages) as Array<keyof typeof defaultMessages>) {
                expect(placeholders(dashboardMessages[locale][key]), `${locale}:${key}`)
                    .toEqual(placeholders(defaultMessages[key]));
            }
        }
    });
});

function placeholders(message: string): string[] {
    return [...message.matchAll(/\{([A-Za-z0-9_]+)\}/g)]
        .map(match => match[1] ?? "")
        .sort();
}
