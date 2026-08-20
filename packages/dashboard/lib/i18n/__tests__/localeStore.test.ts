import { afterEach, describe, expect, it } from "vitest";
import {
    DASHBOARD_LOCALE_STORAGE_KEY,
    DASHBOARD_LOCALE_COOKIE_KEY,
    dashboardLocaleMetadata,
    dashboardLocales,
    defaultDashboardLocale,
    getDashboardLocale,
    getDashboardLocaleFromAcceptLanguage,
    getDashboardIntlLocale,
    getInitialDashboardLocale,
    getDashboardLocaleValue,
    getStoredDashboardLocale,
    getStoredDashboardCookieLocale,
    setDashboardLocale,
    subscribeDashboardLocale,
} from "@/lib/i18n/localeStore";

describe("dashboard locale store", () => {
    afterEach(() => {
        window.localStorage.clear();
        document.cookie = `${DASHBOARD_LOCALE_COOKIE_KEY}=; Path=/; Max-Age=0`;
        setDashboardLocale("en", false);
    });

    it("prefers a persisted user choice over browser language", () => {
        window.localStorage.setItem(DASHBOARD_LOCALE_STORAGE_KEY, "nl");
        expect(getStoredDashboardLocale()).toBe("nl");
        expect(getInitialDashboardLocale()).toBe("nl");
    });

    it("negotiates language quality values with English fallback", () => {
        expect(getDashboardLocaleFromAcceptLanguage("nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
        expect(getDashboardLocaleFromAcceptLanguage("nl;q=0.3,en-GB;q=0.9")).toBe("en");
        expect(getDashboardLocaleFromAcceptLanguage("nl;q=0,en;q=0.8")).toBe("en");
        expect(getDashboardLocaleFromAcceptLanguage("fr-FR")).toBe("en");
        expect(getDashboardLocaleFromAcceptLanguage(["fr-FR", "nl-NL"])).toBe("nl");
    });

    it("derives locale metadata and values from the shared registry", () => {
        expect(Object.keys(dashboardLocaleMetadata)).toEqual([...dashboardLocales]);
        expect(dashboardLocales).toContain(defaultDashboardLocale);
        expect(getDashboardIntlLocale("nl")).toBe(dashboardLocaleMetadata.nl.languageTag);
        expect(getDashboardLocaleValue("nl", { en: "Save", nl: "Opslaan" })).toBe("Opslaan");
    });

    it("notifies subscribers and persists explicit changes", () => {
        const received: string[] = [];
        const unsubscribe = subscribeDashboardLocale(locale => received.push(locale));

        setDashboardLocale("nl");
        unsubscribe();

        expect(getDashboardLocale()).toBe("nl");
        expect(window.localStorage.getItem(DASHBOARD_LOCALE_STORAGE_KEY)).toBe("nl");
        expect(getStoredDashboardCookieLocale()).toBe("nl");
        expect(received).toEqual(["nl"]);
    });

    it("uses the server-readable cookie when local storage has no choice", () => {
        document.cookie = `${DASHBOARD_LOCALE_COOKIE_KEY}=nl; Path=/`;

        expect(getStoredDashboardCookieLocale()).toBe("nl");
        expect(getInitialDashboardLocale()).toBe("nl");
    });
});
