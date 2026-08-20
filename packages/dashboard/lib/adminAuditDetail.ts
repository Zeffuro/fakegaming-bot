import type { DashboardLocale } from "@/lib/i18n/localeStore";
import { formatDashboardMessage } from "@/lib/i18n/messages";

const summaryKeyLimit = 4;
const sensitiveKeyPattern = /(?:authorization|cookie|csrf|jwt|password|secret|token|key|credential|session)/i;
const maxStringLength = 512;
const maxArrayLength = 20;
const maxDepth = 4;

export interface AdminAuditMetadataView {
    hasMetadata: boolean;
    keyCount: number;
    keys: string[];
    summary: string;
    formatted: string;
}

export function buildAdminAuditMetadataView(
    metadata: Record<string, unknown> | null,
    locale: DashboardLocale = "en",
): AdminAuditMetadataView {
    const sanitized = sanitizeAuditMetadataForDisplay(metadata);
    if (!sanitized || Object.keys(sanitized).length === 0) {
        return {
            hasMetadata: false,
            keyCount: 0,
            keys: [],
            summary: formatDashboardMessage(locale, "admin.auditNoMetadata"),
            formatted: formatDashboardMessage(locale, "admin.auditNoMetadataRecorded"),
        };
    }

    const keys = Object.keys(sanitized).sort((left, right) => left.localeCompare(right));
    return {
        hasMetadata: true,
        keyCount: keys.length,
        keys,
        summary: formatMetadataSummary(sanitized, keys, locale),
        formatted: JSON.stringify(sanitized, null, 2),
    };
}

function formatMetadataSummary(
    metadata: Record<string, unknown>,
    keys: readonly string[],
    locale: DashboardLocale,
): string {
    const leagueFormSummary = formatLeagueFormSummary(metadata, locale);
    if (leagueFormSummary) return leagueFormSummary;

    const visibleKeys = keys.slice(0, summaryKeyLimit);
    const hiddenCount = Math.max(0, keys.length - visibleKeys.length);
    const suffix = hiddenCount > 0
        ? formatDashboardMessage(locale, "admin.auditMetadataMore", { count: hiddenCount })
        : "";
    return formatDashboardMessage(
        locale,
        keys.length === 1 ? "admin.auditMetadataSummaryOne" : "admin.auditMetadataSummaryMany",
        { count: keys.length, keys: visibleKeys.join(", "), suffix },
    );
}

function formatLeagueFormSummary(metadata: Record<string, unknown>, locale: DashboardLocale): string | null {
    if (readString(metadata.provider) !== "riot" || readString(metadata.game) !== "league") return null;

    const outcome = readString(metadata.outcome);
    if (!outcome) return null;

    const parts = [formatDashboardMessage(locale, "admin.auditLeagueForm", { outcome })];
    const source = readString(metadata.source);
    const cacheStatus = readString(metadata.cacheStatus);
    const refreshRequested = readBoolean(metadata.refreshRequested);
    const summaryStatus = readString(metadata.summaryStatus);
    const matchCount = readNumber(metadata.matchCount);
    const wins = readNumber(metadata.wins);
    const losses = readNumber(metadata.losses);
    const failedDetailCount = readNumber(metadata.failedDetailCount);
    const requestedMatchCount = readNumber(metadata.requestedMatchCount);
    const errorCategory = readString(metadata.errorCategory);

    if (source) parts.push(formatDashboardMessage(locale, "admin.auditFrom", { source }));
    if (cacheStatus) parts.push(formatDashboardMessage(locale, "admin.auditCache", { status: cacheStatus }));
    if (refreshRequested === true) parts.push(formatDashboardMessage(locale, "admin.auditRefreshRequested"));
    if (summaryStatus) parts.push(summaryStatus);
    if (matchCount !== null) parts.push(formatDashboardMessage(
        locale,
        matchCount === 1 ? "admin.auditMatchOne" : "admin.auditMatchMany",
        { count: matchCount },
    ));
    if (wins !== null && losses !== null) parts.push(formatDashboardMessage(locale, "admin.auditRecord", { wins, losses }));
    if (failedDetailCount !== null && failedDetailCount > 0) {
        parts.push(formatDashboardMessage(locale, "admin.auditDetailFailures", {
            failed: failedDetailCount,
            requested: requestedMatchCount ?? "?",
        }));
    }
    if (errorCategory) parts.push(errorCategory);

    return parts.join(" - ");
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

function sanitizeAuditMetadataForDisplay(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!metadata) return null;
    const sanitized = sanitizeValue(metadata, 0);
    return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
        ? sanitized as Record<string, unknown>
        : { value: sanitized };
}

function sanitizeValue(value: unknown, depth: number): unknown {
    if (value === null || value === undefined) return value;

    if (value instanceof Date) return value.toISOString();

    if (typeof value === "string") {
        return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...` : value;
    }

    if (typeof value === "number" || typeof value === "boolean") return value;

    if (Array.isArray(value)) {
        if (depth >= maxDepth) return "[truncated]";
        return value.slice(0, maxArrayLength).map(item => sanitizeValue(item, depth + 1));
    }

    if (typeof value === "object") {
        if (depth >= maxDepth) return "[truncated]";
        const output: Record<string, unknown> = {};
        for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
            output[key] = sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeValue(nestedValue, depth + 1);
        }
        return output;
    }

    return String(value);
}
