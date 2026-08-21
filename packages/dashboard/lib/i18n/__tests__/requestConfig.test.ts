import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMocks = vi.hoisted(() => ({
    cookieLocale: undefined as string | undefined,
    acceptLanguage: "en-US,en;q=0.9" as string | null,
}));

vi.mock("next/headers", () => ({
    cookies: vi.fn(async () => ({
        get: (name: string) => name === "fg.dashboard.locale" && requestMocks.cookieLocale
            ? { value: requestMocks.cookieLocale }
            : undefined,
    })),
    headers: vi.fn(async () => ({
        get: (name: string) => name === "accept-language" ? requestMocks.acceptLanguage : null,
    })),
}));

import { getDashboardRequestConfig } from "../../../i18n/request";

describe("next-intl request configuration", () => {
    beforeEach(() => {
        requestMocks.cookieLocale = undefined;
        requestMocks.acceptLanguage = "en-US,en;q=0.9";
    });

    it("prefers the persisted dashboard cookie", async () => {
        requestMocks.cookieLocale = "nl";
        const config = await getDashboardRequestConfig();

        expect(config.locale).toBe("nl");
        expect(config.messages.common.save).toBe("Opslaan");
    });

    it("negotiates Accept-Language when the cookie is absent or unsupported", async () => {
        requestMocks.cookieLocale = "de";
        requestMocks.acceptLanguage = "nl-NL,nl;q=0.9,en;q=0.8";
        const config = await getDashboardRequestConfig();

        expect(config.locale).toBe("nl");
    });
});
