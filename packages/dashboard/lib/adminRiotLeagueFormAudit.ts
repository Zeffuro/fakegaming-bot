import type { AuditEventEntry } from "@/lib/api/audit";

export interface RiotLeagueFormCount {
    label: string;
    count: number;
}

export interface RiotLeagueFormAuditSummary {
    total: number;
    successes: number;
    failures: number;
    warnings: number;
    cacheHits: number;
    cacheMisses: number;
    cacheBypasses: number;
    liveAttempts: number;
    refreshRequests: number;
    partials: number;
    emptyHistory: number;
    detailFailures: number;
    outcomes: RiotLeagueFormCount[];
    errorCategories: RiotLeagueFormCount[];
}

export function buildRiotLeagueFormAuditSummary(events: readonly AuditEventEntry[]): RiotLeagueFormAuditSummary | null {
    const summary: RiotLeagueFormAuditSummary = {
        total: 0,
        successes: 0,
        failures: 0,
        warnings: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheBypasses: 0,
        liveAttempts: 0,
        refreshRequests: 0,
        partials: 0,
        emptyHistory: 0,
        detailFailures: 0,
        outcomes: [],
        errorCategories: [],
    };
    const outcomes = new Map<string, number>();
    const errorCategories = new Map<string, number>();

    for (const event of events) {
        if (event.action !== "riot.leagueForm") continue;

        summary.total += 1;
        if (event.status === "success") summary.successes += 1;
        if (event.status === "failure") summary.failures += 1;
        if (event.severity === "warn") summary.warnings += 1;

        const metadata = event.metadata;
        const outcome = readMetadataString(metadata, "outcome");
        const source = readMetadataString(metadata, "source");
        const summaryStatus = readMetadataString(metadata, "summaryStatus");
        const failedDetailCount = readMetadataNumber(metadata, "failedDetailCount");
        const refreshRequested = readMetadataBoolean(metadata, "refreshRequested");
        const cacheStatus = readMetadataString(metadata, "cacheStatus");
        const errorCategory = readMetadataString(metadata, "errorCategory");

        if (outcome) incrementCount(outcomes, outcome);
        if (outcome === "cache_hit") summary.cacheHits += 1;
        if (cacheStatus === "hit") summary.cacheHits += outcome === "cache_hit" ? 0 : 1;
        if (cacheStatus === "miss") summary.cacheMisses += 1;
        if (cacheStatus === "bypass") summary.cacheBypasses += 1;
        if (source === "live" || isLiveAttemptOutcome(outcome)) {
            summary.liveAttempts += 1;
        }
        if (refreshRequested === true) summary.refreshRequests += 1;
        if (outcome === "live_partial" || summaryStatus === "partial") summary.partials += 1;
        if (outcome === "empty_history" || summaryStatus === "empty_history") summary.emptyHistory += 1;
        if (failedDetailCount !== null && failedDetailCount > 0) summary.detailFailures += failedDetailCount;
        if (errorCategory) incrementCount(errorCategories, errorCategory);
    }

    if (summary.total === 0) return null;

    return {
        ...summary,
        outcomes: sortCounts(outcomes),
        errorCategories: sortCounts(errorCategories),
    };
}

function incrementCount(counts: Map<string, number>, key: string): void {
    counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortCounts(counts: Map<string, number>): RiotLeagueFormCount[] {
    return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function isLiveAttemptOutcome(outcome: string | null): boolean {
    return outcome === "live_success"
        || outcome === "live_partial"
        || outcome === "empty_history"
        || outcome === "history_failure"
        || outcome === "malformed_history"
        || outcome === "detail_failure";
}

function readMetadataString(metadata: Record<string, unknown> | null, key: string): string | null {
    const value = metadata?.[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readMetadataNumber(metadata: Record<string, unknown> | null, key: string): number | null {
    const value = metadata?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readMetadataBoolean(metadata: Record<string, unknown> | null, key: string): boolean | null {
    const value = metadata?.[key];
    return typeof value === "boolean" ? value : null;
}
