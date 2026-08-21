import React, { useEffect } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/core";
import {
    DASHBOARD_LOCALE_COOKIE_KEY,
    DASHBOARD_LOCALE_STORAGE_KEY,
    getDashboardLocale,
    setDashboardLocale,
    type DashboardLocale,
} from "@/lib/i18n/localeStore";
import { DashboardI18nProvider, useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { DashboardLanguageSelector } from "@/components/i18n/DashboardLanguageSelector";

const apiMocks = vi.hoisted(() => ({
    getUserSettings: vi.fn(),
    updateUserSettings: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ api: apiMocks }));

function Consumer() {
    const { locale, setLocale, t, formatDate, formatNumber, formatRelativeTime } = useDashboardI18n();
    return (
        <>
            <span>{locale}</span>
            <span>{t("common.save")}</span>
            <span>{formatDate("2026-01-01T00:30:00Z", { dateStyle: "medium" })}</span>
            <span>{formatNumber(1234.5)}</span>
            <span>{formatRelativeTime(-1, "day", { numeric: "auto" })}</span>
            <button onClick={() => setLocale("en")}>English</button>
        </>
    );
}

function InitialRequestProbe({ onRequest }: { onRequest: (locale: DashboardLocale) => void }) {
    useEffect(() => {
        onRequest(getDashboardLocale());
        void apiRequest("/api/locale-probe");
    }, [onRequest]);

    return null;
}

describe("DashboardI18nProvider", () => {
    beforeEach(() => {
        apiMocks.getUserSettings.mockReset();
        apiMocks.updateUserSettings.mockReset();
    });

    afterEach(() => {
        window.localStorage.clear();
        document.cookie = `${DASHBOARD_LOCALE_COOKIE_KEY}=; Path=/; Max-Age=0`;
        setDashboardLocale("en", false);
        vi.restoreAllMocks();
    });

    it("server-renders with the request locale before browser preference synchronization", () => {
        const html = renderToString(
            <DashboardI18nProvider initialLocale="nl"><Consumer /></DashboardI18nProvider>,
        );

        expect(html).toContain("Opslaan");
        expect(html).toContain("1 jan 2026");
        expect(html).toContain("1.234,5");
    });

    it("synchronizes the request locale before a child sends its first API request", async () => {
        setDashboardLocale("en", false);
        document.cookie = `${DASHBOARD_LOCALE_COOKIE_KEY}=nl; Path=/`;
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
            JSON.stringify({ ok: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        ));
        const observedLocales: DashboardLocale[] = [];
        const container = document.createElement("div");
        const root = createRoot(container);

        await act(async () => {
            root.render(
                <DashboardI18nProvider initialLocale="nl">
                    <InitialRequestProbe onRequest={locale => observedLocales.push(locale)} />
                </DashboardI18nProvider>,
            );
        });

        expect(observedLocales).toEqual(["nl"]);
        expect(fetchMock).toHaveBeenCalledWith("/api/locale-probe", expect.objectContaining({
            headers: expect.objectContaining({ "Accept-Language": "nl" }),
        }));

        await act(async () => root.unmount());
    });

    it("uses the persisted dashboard locale before rendering children", async () => {
        window.localStorage.setItem(DASHBOARD_LOCALE_STORAGE_KEY, "nl");
        const container = document.createElement("div");
        const root = createRoot(container);
        await act(async () => {
            root.render(<DashboardI18nProvider><Consumer /></DashboardI18nProvider>);
        });
        await act(async () => Promise.resolve());

        expect(container.textContent).toContain("nl");
        expect(container.textContent).toContain("Opslaan");
        expect(container.textContent).toContain("1.234,5");
        expect(container.textContent).toContain("gisteren");

        await act(async () => container.querySelector("button")?.click());
        expect(container.textContent).toContain("Save");
        await act(async () => root.unmount());
    });

    it("restores an authenticated account preference in the language selector", async () => {
        apiMocks.getUserSettings.mockResolvedValue({
            discordId: "user-1",
            timezone: null,
            defaultReminderTimeSpan: null,
            preferredLocale: "nl",
        });
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(
                <DashboardI18nProvider>
                    <DashboardLanguageSelector />
                </DashboardI18nProvider>,
            );
        });
        await act(async () => Promise.resolve());

        expect(apiMocks.getUserSettings).toHaveBeenCalledOnce();
        expect(document.documentElement.lang).toBe("nl");
        expect(container.textContent).toContain("Nederlands");

        await act(async () => root.unmount());
        container.remove();
    });

    it("does not request account settings for a public language selector", async () => {
        const container = document.createElement("div");
        const root = createRoot(container);

        await act(async () => {
            root.render(
                <DashboardI18nProvider>
                    <DashboardLanguageSelector syncAccount={false} />
                </DashboardI18nProvider>,
            );
        });
        await act(async () => Promise.resolve());

        expect(apiMocks.getUserSettings).not.toHaveBeenCalled();
        await act(async () => root.unmount());
    });
});
