import { describe, expect, it } from "vitest";
import {
    buildPersonalRiotSummary,
    displayRiotId,
    formatRiotRegion,
} from "@/lib/personalRiotSummary";
import type { RiotLinkEntry } from "@/lib/api-client";

function formatDate(value: string | null): string {
    return value ? `formatted:${value}` : "unknown";
}

function riotLink(overrides: Partial<RiotLinkEntry> = {}): RiotLinkEntry {
    return {
        discordId: "user-1",
        summonerName: "LegacyName",
        riotIdGameName: "Player",
        riotIdTagLine: "EUW",
        region: "euw1",
        puuid: "puuid-1",
        createdAt: "2026-06-23T10:00:00.000Z",
        updatedAt: "2026-06-24T10:00:00.000Z",
        ...overrides,
    };
}

describe("personalRiotSummary", () => {
    it("builds a linked summary for command-ready accounts", () => {
        const summary = buildPersonalRiotSummary(riotLink(), formatDate);

        expect(summary.linked).toBe(true);
        expect(summary.badgeLabel).toBe("Linked");
        expect(summary.summaryText).toBe("Player#EUW in EUW1");
        expect(summary.helperText).toContain("League and TFT commands");
        expect(summary.rows).toEqual([
            { label: "Riot ID", value: "Player#EUW", tone: "default" },
            { label: "Region", value: "EUW1", tone: "default" },
            { label: "Command status", value: "Ready for League and TFT commands", tone: "success" },
            { label: "Updated", value: "formatted:2026-06-24T10:00:00.000Z", tone: "default" },
        ]);
    });

    it("builds an unlinked summary", () => {
        const summary = buildPersonalRiotSummary(null, formatDate);

        expect(summary.linked).toBe(false);
        expect(summary.badgeLabel).toBe("No link");
        expect(summary.summaryText).toBe("No linked Riot account");
        expect(summary.rows).toEqual([]);
    });

    it("falls back to legacy summoner names when Riot ID parts are missing", () => {
        expect(displayRiotId(riotLink({ riotIdGameName: null, riotIdTagLine: null }))).toBe("LegacyName");
    });

    it("normalizes blank regions and missing account keys", () => {
        const summary = buildPersonalRiotSummary(riotLink({ region: " ", puuid: " ", updatedAt: null }), formatDate);

        expect(formatRiotRegion(" ")).toBe("Unknown");
        expect(summary.summaryText).toBe("Player#EUW in Unknown");
        expect(summary.rows).toContainEqual({
            label: "Command status",
            value: "Missing account key",
            tone: "warning",
        });
        expect(summary.rows).toContainEqual({
            label: "Updated",
            value: "formatted:2026-06-23T10:00:00.000Z",
            tone: "default",
        });
    });
});
