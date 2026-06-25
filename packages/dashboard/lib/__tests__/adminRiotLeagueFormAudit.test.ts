import { describe, expect, it } from "vitest";
import { buildRiotLeagueFormAuditSummary } from "@/lib/adminRiotLeagueFormAudit";
import type { AuditEventEntry } from "@/lib/api/audit";

function auditEvent(partial: Partial<AuditEventEntry>): AuditEventEntry {
    return {
        id: 1,
        timestamp: "2026-06-25T10:00:00.000Z",
        actorId: "user-1",
        actorType: "user",
        action: "riot.leagueForm",
        targetType: "riotRecentForm",
        targetId: "EUW1",
        guildId: "guild-1",
        severity: "info",
        status: "success",
        requestId: "request-1",
        metadata: null,
        ...partial,
    };
}

describe("admin Riot League form audit summary", () => {
    it("summarizes loaded Riot League form outcome patterns", () => {
        const summary = buildRiotLeagueFormAuditSummary([
            auditEvent({
                id: 1,
                metadata: {
                    outcome: "cache_hit",
                    source: "cache",
                    refreshRequested: false,
                    cacheStatus: "hit",
                    summaryStatus: "fresh",
                    matchCount: 5,
                    wins: 3,
                    losses: 2,
                },
            }),
            auditEvent({
                id: 2,
                severity: "warn",
                metadata: {
                    outcome: "live_partial",
                    source: "live",
                    refreshRequested: true,
                    cacheStatus: "bypass",
                    summaryStatus: "partial",
                    failedDetailCount: 2,
                    requestedMatchCount: 5,
                },
            }),
            auditEvent({
                id: 3,
                severity: "error",
                status: "failure",
                metadata: {
                    outcome: "history_failure",
                    cacheStatus: "miss",
                    errorCategory: "rate_limited",
                },
            }),
            auditEvent({
                id: 4,
                action: "riotLink.upsert",
                metadata: { outcome: "ignored" },
            }),
        ]);

        expect(summary).toEqual({
            total: 3,
            successes: 2,
            failures: 1,
            warnings: 1,
            cacheHits: 1,
            cacheMisses: 1,
            cacheBypasses: 1,
            liveAttempts: 2,
            refreshRequests: 1,
            partials: 1,
            emptyHistory: 0,
            detailFailures: 2,
            outcomes: [
                { label: "cache_hit", count: 1 },
                { label: "history_failure", count: 1 },
                { label: "live_partial", count: 1 },
            ],
            errorCategories: [{ label: "rate_limited", count: 1 }],
        });
    });

    it("counts provider-attempt failure outcomes as live attempts", () => {
        const summary = buildRiotLeagueFormAuditSummary([
            auditEvent({ metadata: { outcome: "missing_identity", cacheStatus: "not_checked" } }),
            auditEvent({ status: "failure", severity: "error", metadata: { outcome: "identity_failure", cacheStatus: "not_checked", errorCategory: "missing_key" } }),
            auditEvent({ metadata: { outcome: "unsupported_region", cacheStatus: "miss" } }),
            auditEvent({ status: "failure", severity: "error", metadata: { outcome: "malformed_history", cacheStatus: "miss" } }),
            auditEvent({ status: "failure", severity: "error", metadata: { outcome: "detail_failure", cacheStatus: "bypass", failedDetailCount: 3 } }),
        ]);

        expect(summary).toMatchObject({
            total: 5,
            failures: 3,
            cacheMisses: 2,
            cacheBypasses: 1,
            liveAttempts: 2,
            refreshRequests: 0,
            detailFailures: 3,
            errorCategories: [{ label: "missing_key", count: 1 }],
        });
        expect(summary?.outcomes).toContainEqual({ label: "identity_failure", count: 1 });
    });

    it("returns null when no League form events are loaded", () => {
        expect(buildRiotLeagueFormAuditSummary([
            auditEvent({ action: "riotLink.upsert", metadata: { outcome: "cache_hit" } }),
        ])).toBeNull();
    });

    it("tolerates missing and malformed metadata", () => {
        const summary = buildRiotLeagueFormAuditSummary([
            auditEvent({
                metadata: {
                    outcome: 123,
                    failedDetailCount: "2",
                    errorCategory: "",
                },
            }),
        ]);

        expect(summary).toMatchObject({
            total: 1,
            successes: 1,
            failures: 0,
            cacheMisses: 0,
            cacheBypasses: 0,
            detailFailures: 0,
            refreshRequests: 0,
            outcomes: [],
            errorCategories: [],
        });
    });
});
