import { describe, expect, it } from "vitest";
import {
    getAdminProviderDashboardLinks,
    normalizeProviderDashboardKey,
} from "@/lib/adminProviderDashboardLinks";

describe("adminProviderDashboardLinks", () => {
    it("links known providers to the provider page before shared guild pages", () => {
        expect(getAdminProviderDashboardLinks({ provider: "tiktok", guildId: "135384717284343808" })).toEqual([
            {
                id: "provider",
                label: "Provider page",
                href: "/dashboard/tiktok/135384717284343808",
                kind: "provider",
            },
            {
                id: "guild",
                label: "Server overview",
                href: "/dashboard/135384717284343808",
                kind: "guild",
            },
            {
                id: "notifications",
                label: "Notification setup",
                href: "/dashboard/settings/135384717284343808/notifications",
                kind: "notifications",
            },
        ]);
    });

    it("normalizes provider aliases and encodes guild IDs", () => {
        expect(getAdminProviderDashboardLinks({ provider: "Steam News", guildId: "guild one" })[0]).toMatchObject({
            href: "/dashboard/steam-news/guild%20one",
            kind: "provider",
        });
        expect(getAdminProviderDashboardLinks({ provider: "patch-note", guildId: "guild/one" })[0]?.href).toBe("/dashboard/patch-notes/guild%2Fone");
        expect(getAdminProviderDashboardLinks({ provider: "birthdays", guildId: "guild-1" })[0]?.href).toBe("/dashboard/birthdays/guild-1");
    });

    it("falls back to guild-level pages for unknown providers", () => {
        expect(getAdminProviderDashboardLinks({ provider: "custom-provider", guildId: "guild-1" })).toEqual([
            {
                id: "guild",
                label: "Server overview",
                href: "/dashboard/guild-1",
                kind: "guild",
            },
            {
                id: "notifications",
                label: "Notification setup",
                href: "/dashboard/settings/guild-1/notifications",
                kind: "notifications",
            },
        ]);
    });

    it("does not create links without a guild ID", () => {
        expect(getAdminProviderDashboardLinks({ provider: "youtube", guildId: null })).toEqual([]);
        expect(getAdminProviderDashboardLinks({ provider: "youtube", guildId: "   " })).toEqual([]);
    });

    it("normalizes dashboard provider keys", () => {
        expect(normalizeProviderDashboardKey("steam-news")).toBe("steamnews");
        expect(normalizeProviderDashboardKey("Patch Notes")).toBe("patchnotes");
        expect(normalizeProviderDashboardKey("birthdays")).toBe("birthday");
    });
});
