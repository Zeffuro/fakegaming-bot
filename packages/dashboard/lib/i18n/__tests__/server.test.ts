import { describe, expect, it } from "vitest";
import {
    getRequestDashboardLocale,
    getRequestDashboardLocaleFromRequest,
    getRequestDashboardMessage,
    getRequestDashboardMessageFromRequest,
} from "@/lib/i18n/server";

describe("server dashboard locale", () => {
    it("prefers the explicit dashboard locale over Accept-Language", () => {
        expect(getRequestDashboardLocale("en-US,en;q=0.9", "nl")).toBe("nl");
        expect(getRequestDashboardMessage("en-US", "common.save", "nl")).toBe("Opslaan");
    });

    it("falls back to Accept-Language when the preference is absent or invalid", () => {
        expect(getRequestDashboardLocale("nl-NL,nl;q=0.9")).toBe("nl");
        expect(getRequestDashboardLocale("nl-NL", "de")).toBe("nl");
        expect(getRequestDashboardLocale("en-US")).toBe("en");
    });

    it("uses the persisted dashboard locale from a server request", () => {
        const request = {
            headers: { get: () => "en-US,en;q=0.9" },
            cookies: {
                get: (name: string) => name === "fg.dashboard.locale" ? { value: "nl" } : undefined,
            },
        };

        expect(getRequestDashboardLocaleFromRequest(request)).toBe("nl");
        expect(getRequestDashboardMessageFromRequest(request, "common.save")).toBe("Opslaan");
    });
});
