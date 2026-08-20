import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardI18nProvider } from "@/components/i18n/DashboardI18nProvider";
import { PrivacyPageContent } from "@/components/legal/PrivacyPageContent";
import { TermsPageContent } from "@/components/legal/TermsPageContent";
import { DASHBOARD_LOCALE_COOKIE_KEY, DASHBOARD_LOCALE_STORAGE_KEY } from "@/lib/i18n/localeStore";
import type { PublicLegalConfig } from "@/lib/legalConfig";

const legalConfig: PublicLegalConfig = {
    isPublicInstance: true,
    instanceName: "Example Community",
    instanceDomain: "example.test",
    operatorName: "Example Operator",
    operatorCountry: "NL",
    storageCountries: ["Netherlands"],
    privacyContact: "privacy@example.test",
};

async function renderWithDutchLocale(element: React.ReactNode): Promise<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> {
    window.localStorage.setItem(DASHBOARD_LOCALE_STORAGE_KEY, "nl");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(<DashboardI18nProvider>{element}</DashboardI18nProvider>);
    });
    return { container, root };
}

describe("legal page localization", () => {
    afterEach(() => {
        window.localStorage.clear();
        document.cookie = `${DASHBOARD_LOCALE_COOKIE_KEY}=; Path=/; Max-Age=0`;
        document.body.replaceChildren();
    });

    it("renders Dutch terms while preserving configured instance data", async () => {
        const { container, root } = await renderWithDutchLocale(<TermsPageContent legalConfig={legalConfig} />);

        expect(container.textContent).toContain("Gebruiksvoorwaarden");
        expect(container.textContent).toContain("Toegang tot het dashboard");
        expect(container.textContent).toContain("Example Community");
        expect(container.textContent).toContain("Example Operator");

        await act(async () => root.unmount());
    });

    it("renders Dutch privacy copy while preserving provider and contact data", async () => {
        const { container, root } = await renderWithDutchLocale(<PrivacyPageContent legalConfig={legalConfig} />);

        expect(container.textContent).toContain("Privacy en cookies");
        expect(container.textContent).toContain("Landen van gegevensopslag:");
        expect(container.textContent).toContain("Netherlands");
        expect(container.textContent).toContain("privacy@example.test");
        expect(container.textContent).toContain("Discord Developer Policy");

        await act(async () => root.unmount());
    });
});
