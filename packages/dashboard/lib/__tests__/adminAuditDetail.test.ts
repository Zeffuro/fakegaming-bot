import { describe, expect, it } from "vitest";
import { buildAdminAuditMetadataView } from "@/lib/adminAuditDetail";

describe("admin audit detail helpers", () => {
    it("returns an empty metadata view when no metadata exists", () => {
        expect(buildAdminAuditMetadataView(null)).toEqual({
            hasMetadata: false,
            keyCount: 0,
            keys: [],
            summary: "No metadata",
            formatted: "No metadata recorded for this event.",
        });
    });

    it("summarizes sorted metadata keys and caps summary length", () => {
        const view = buildAdminAuditMetadataView({
            zebra: true,
            alpha: "one",
            middle: 2,
            beta: "two",
            omega: "last",
        });

        expect(view).toMatchObject({
            hasMetadata: true,
            keyCount: 5,
            keys: ["alpha", "beta", "middle", "omega", "zebra"],
            summary: "5 metadata keys: alpha, beta, middle, omega, +1 more",
        });
    });

    it("redacts sensitive-looking keys before formatting", () => {
        const view = buildAdminAuditMetadataView({
            token: "secret",
            nested: {
                sessionCookie: "cookie",
                visible: "safe",
            },
        });

        expect(view.formatted).toContain('"token": "[redacted]"');
        expect(view.formatted).toContain('"sessionCookie": "[redacted]"');
        expect(view.formatted).toContain('"visible": "safe"');
        expect(view.formatted).not.toContain("secret");
        expect(view.formatted).not.toContain("cookie");
    });

    it("summarizes Riot League form success metadata for audit dogfooding", () => {
        const view = buildAdminAuditMetadataView({
            provider: "riot",
            game: "league",
            outcome: "live_partial",
            source: "live",
            cacheStatus: "bypass",
            refreshRequested: true,
            summaryStatus: "partial",
            matchCount: 4,
            wins: 3,
            losses: 1,
            requestedMatchCount: 5,
            failedDetailCount: 1,
        });

        expect(view.summary).toBe("League form live_partial - from live - cache bypass - refresh requested - partial - 4 matches - 3W-1L - 1/5 detail failures");
        expect(view.formatted).toContain('"provider": "riot"');
    });

    it("summarizes Riot League form failure metadata with error category", () => {
        const view = buildAdminAuditMetadataView({
            provider: "riot",
            game: "league",
            outcome: "history_failure",
            cacheStatus: "miss",
            errorCategory: "rate_limited",
        });

        expect(view.summary).toBe("League form history_failure - cache miss - rate_limited");
    });

    it("summarizes Riot League form identity failures for dogfood review", () => {
        const view = buildAdminAuditMetadataView({
            provider: "riot",
            game: "league",
            outcome: "identity_failure",
            cacheStatus: "not_checked",
            errorCategory: "missing_key",
        });

        expect(view.summary).toBe("League form identity_failure - cache not_checked - missing_key");
    });
});
