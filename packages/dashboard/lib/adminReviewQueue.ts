import type { AdminOperationsHealth, AdminOperationsHealthIssue } from "@/lib/adminOperationsHealth";
import { buildAdminAuditMetadataView } from "@/lib/adminAuditDetail";
import { formatAdminProviderCooldownSummary, getAdminProviderCooldownHint } from "@/lib/adminProviderCooldown";
import { formatAdminProviderPlaybookSummary, getAdminProviderPlaybookHint } from "@/lib/adminProviderPlaybooks";
import type { AuditEventEntry, IntegrationHealthRecord, IntegrationHealthStatus, JobRunEntry } from "@/lib/api-client";
import { formatDashboardMessage, type DashboardMessageKey } from "@/lib/i18n/messages";
import type { DashboardLocale } from "@/lib/i18n/localeStore";

export type AdminReviewSeverity = "critical" | "warning" | "info";
export type AdminReviewSource = "operations" | "integration-health" | "jobs" | "audit";

export interface AdminReviewQueueItem {
    id: string;
    title: string;
    detail: string;
    severity: AdminReviewSeverity;
    source: AdminReviewSource;
    href: string;
    timestamp?: string | null;
    relatedItems?: AdminReviewQueueRelatedItem[];
}

export interface AdminReviewQueueRelatedItem {
    id: string;
    title: string;
    detail: string;
    href: string;
    timestamp?: string | null;
}

export interface AdminReviewQueueJob {
    name: string;
    latestRun: JobRunEntry | null;
    failedRecentRuns: number;
    totalRecentRuns: number;
    error?: string;
}

export interface BuildAdminReviewQueueInput {
    operationsHealth?: Pick<AdminOperationsHealth, "issues"> | null;
    healthRecords?: IntegrationHealthRecord[];
    jobs?: AdminReviewQueueJob[];
    auditEvents?: AuditEventEntry[];
    limit?: number;
}

const defaultLimit = 8;
const actionableHealthStatuses = new Set<IntegrationHealthStatus>(["error", "warning", "unknown"]);
const severityRank: Record<AdminReviewSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
};
const sourceRank: Record<AdminReviewSource, number> = {
    operations: 0,
    "integration-health": 1,
    jobs: 2,
    audit: 3,
};

type ReviewQueueMessageKey = Extract<DashboardMessageKey, `admin.helperCopy.reviewQueue.${string}`>;
type OperationsIssueKey = "integrationErrors" | "failedJobRuns" | "jobStatusUnavailable"
    | "staleWorkerHeartbeat" | "healthWarnings" | "missingWorkerHeartbeat" | "partialOverviewData";

const operationsIssueKeys: Readonly<Record<string, OperationsIssueKey>> = {
    "Integration errors": "integrationErrors",
    "Failed job runs": "failedJobRuns",
    "Job status unavailable": "jobStatusUnavailable",
    "Stale worker heartbeat": "staleWorkerHeartbeat",
    "Health warnings": "healthWarnings",
    "Missing worker heartbeat": "missingWorkerHeartbeat",
    "Partial overview data": "partialOverviewData",
};

function reviewMessage(
    locale: DashboardLocale,
    key: ReviewQueueMessageKey,
    values?: Record<string, string | number>,
): string {
    return formatDashboardMessage(locale, key, values);
}

export function buildAdminReviewQueue(
    input: BuildAdminReviewQueueInput,
    locale: DashboardLocale = "en",
): AdminReviewQueueItem[] {
    const operationsItems = buildOperationsItems(input.operationsHealth?.issues ?? [], locale);
    const healthItems = buildHealthItems(input.healthRecords ?? [], locale);
    const jobItems = buildJobItems(input.jobs ?? [], locale);
    const items: AdminReviewQueueItem[] = [
        ...groupOperationsWithDetails(operationsItems, healthItems, jobItems, locale),
        ...buildAuditItems(input.auditEvents ?? [], locale),
    ];
    const limit = Number.isInteger(input.limit) && input.limit !== undefined ? Math.max(0, input.limit) : defaultLimit;
    return items.sort(compareReviewItems).slice(0, limit);
}

function groupOperationsWithDetails(
    operationsItems: AdminReviewQueueItem[],
    healthItems: AdminReviewQueueItem[],
    jobItems: AdminReviewQueueItem[],
    locale: DashboardLocale,
): AdminReviewQueueItem[] {
    const ungroupedHealth = new Set(healthItems.map(item => item.id));
    const ungroupedJobs = new Set(jobItems.map(item => item.id));
    const groupedOperations = operationsItems.map(item => {
        const relatedItems = getRelatedItemsForOperation(item, healthItems, jobItems);
        if (relatedItems.length === 0) return item;

        for (const relatedItem of relatedItems) {
            ungroupedHealth.delete(relatedItem.id);
            ungroupedJobs.delete(relatedItem.id);
        }

        return {
            ...item,
            detail: formatGroupedOperationsDetail(item, relatedItems, locale),
            timestamp: item.timestamp ?? getLatestRelatedTimestamp(relatedItems),
            relatedItems,
        };
    });

    return [
        ...groupedOperations,
        ...healthItems.filter(item => ungroupedHealth.has(item.id)),
        ...jobItems.filter(item => ungroupedJobs.has(item.id)),
    ];
}

function getRelatedItemsForOperation(
    operation: AdminReviewQueueItem,
    healthItems: AdminReviewQueueItem[],
    jobItems: AdminReviewQueueItem[],
): AdminReviewQueueRelatedItem[] {
    if (operation.id === "operations:integration-errors") {
        return healthItems
            .filter(item => item.severity === "critical")
            .sort(compareReviewItems)
            .map(toRelatedItem);
    }
    if (operation.id === "operations:health-warnings") {
        return healthItems
            .filter(item => item.severity === "warning")
            .sort(compareReviewItems)
            .map(toRelatedItem);
    }
    if (operation.id === "operations:failed-job-runs") {
        return jobItems
            .filter(item => item.id.endsWith(":failed"))
            .sort(compareReviewItems)
            .map(toRelatedItem);
    }
    if (operation.id === "operations:job-status-unavailable") {
        return jobItems
            .filter(item => item.id.endsWith(":unavailable"))
            .sort(compareReviewItems)
            .map(toRelatedItem);
    }

    return [];
}

function toRelatedItem(item: AdminReviewQueueItem): AdminReviewQueueRelatedItem {
    const relatedItem: AdminReviewQueueRelatedItem = {
        id: item.id,
        title: item.title,
        detail: item.detail,
        href: item.href,
    };
    if (item.timestamp !== undefined) {
        relatedItem.timestamp = item.timestamp;
    }
    return relatedItem;
}

function formatGroupedOperationsDetail(
    item: AdminReviewQueueItem,
    relatedItems: AdminReviewQueueRelatedItem[],
    locale: DashboardLocale,
): string {
    const relatedCount = relatedItems.length;
    const extraCount = Math.max(0, getOperationIssueValue(item) - relatedCount);
    return reviewMessage(locale, "admin.helperCopy.reviewQueue.groupedDetail", {
        detail: item.detail,
        visibleCount: relatedCount,
        extraCount,
    });
}

function getOperationIssueValue(item: AdminReviewQueueItem): number {
    const match = item.detail.match(/^(\d+)/);
    return match ? Number(match[1]) : 0;
}

function getLatestRelatedTimestamp(relatedItems: AdminReviewQueueRelatedItem[]): string | null {
    const sorted = [...relatedItems].sort((left, right) => getTimestampMs(right.timestamp) - getTimestampMs(left.timestamp));
    return sorted[0]?.timestamp ?? null;
}

function buildOperationsItems(issues: AdminOperationsHealthIssue[], locale: DashboardLocale): AdminReviewQueueItem[] {
    return issues.map(issue => ({
        id: `operations:${normalizeIdPart(issue.label)}`,
        title: formatOperationsIssueTitle(issue.label, locale),
        detail: formatOperationsIssueDetail(issue, locale),
        severity: issue.severity,
        source: "operations",
        href: issue.href ?? "/dashboard/admin",
    }));
}

function buildHealthItems(records: IntegrationHealthRecord[], locale: DashboardLocale): AdminReviewQueueItem[] {
    return records
        .filter(record => actionableHealthStatuses.has(record.status))
        .map(record => {
            const failures = Math.max(0, record.consecutiveFailures);
            const issue = record.lastErrorMessage ?? record.lastErrorCode ?? getHealthStatusLabel(record.status, locale);
            const failureText = failures > 0
                ? reviewMessage(locale, "admin.helperCopy.reviewQueue.failureCount", { count: failures })
                : reviewMessage(locale, "admin.helperCopy.reviewQueue.noFailures");
            const cooldownSummary = formatAdminProviderCooldownSummary(getAdminProviderCooldownHint(record, Date.now(), locale), locale);
            const playbookSummary = formatAdminProviderPlaybookSummary(getAdminProviderPlaybookHint(record, locale), locale);

            return {
                id: `integration-health:${record.provider}:${record.configId}`,
                title: reviewMessage(locale, "admin.helperCopy.reviewQueue.healthTitle", {
                    provider: formatProviderLabel(record.provider, locale),
                    configId: record.configId,
                }),
                detail: [issue, failureText, cooldownSummary, playbookSummary].filter(Boolean).join(" - "),
                severity: record.status === "error" ? "critical" : "warning",
                source: "integration-health",
                href: buildIntegrationHealthHref(record),
                timestamp: record.lastFailureAt ?? record.lastCheckedAt ?? record.updatedAt ?? record.createdAt ?? null,
            };
        });
}

function buildJobItems(jobs: AdminReviewQueueJob[], locale: DashboardLocale): AdminReviewQueueItem[] {
    const items: AdminReviewQueueItem[] = [];
    for (const job of jobs) {
        if (job.error) {
            items.push({
                id: `jobs:${job.name}:unavailable`,
                title: reviewMessage(locale, "admin.helperCopy.reviewQueue.jobUnavailable", { name: job.name }),
                detail: job.error,
                severity: "critical",
                source: "jobs",
                href: buildJobHref(job.name),
            });
            continue;
        }

        const latestRunFailed = job.latestRun?.ok === false;
        if (job.failedRecentRuns <= 0 && !latestRunFailed) continue;

        const latestError = latestRunFailed && job.latestRun?.error ? ` - ${job.latestRun.error}` : "";
        items.push({
            id: `jobs:${job.name}:failed`,
            title: reviewMessage(locale, "admin.helperCopy.reviewQueue.jobFailedTitle", { name: job.name }),
            detail: reviewMessage(locale, "admin.helperCopy.reviewQueue.jobFailedDetail", {
                failed: job.failedRecentRuns,
                total: job.totalRecentRuns,
                latestError,
            }),
            severity: "critical",
            source: "jobs",
            href: buildJobHref(job.name, "failed"),
            timestamp: job.latestRun?.finishedAt ?? null,
        });
    }

    return items;
}

function buildAuditItems(events: AuditEventEntry[], locale: DashboardLocale): AdminReviewQueueItem[] {
    return events
        .filter(event => event.status === "failure")
        .map(event => ({
            id: `audit:${event.id}`,
            title: formatAuditFailureTitle(event, locale),
            detail: formatAuditFailureDetail(event, locale),
            severity: event.severity === "error" ? "critical" : "warning",
            source: "audit",
            href: buildAuditHref(event),
            timestamp: event.timestamp,
        }));
}

function compareReviewItems(a: AdminReviewQueueItem, b: AdminReviewQueueItem): number {
    return severityRank[a.severity] - severityRank[b.severity]
        || sourceRank[a.source] - sourceRank[b.source]
        || getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp)
        || a.title.localeCompare(b.title);
}

function formatOperationsIssueTitle(label: string, locale: DashboardLocale): string {
    const issueKey = operationsIssueKeys[label];
    return issueKey
        ? reviewMessage(locale, `admin.helperCopy.reviewQueue.issueTitles.${issueKey}`)
        : label;
}

function formatOperationsIssueDetail(issue: AdminOperationsHealthIssue, locale: DashboardLocale): string {
    const issueKey = operationsIssueKeys[issue.label];
    return issueKey
        ? reviewMessage(locale, `admin.helperCopy.reviewQueue.issueDetails.${issueKey}`, { value: issue.value })
        : reviewMessage(locale, "admin.helperCopy.reviewQueue.issueDetails.fallback", {
            value: issue.value,
            label: issue.label.toLowerCase(),
        });
}

function buildIntegrationHealthHref(record: IntegrationHealthRecord): string {
    const params = new URLSearchParams({ status: record.status });
    const provider = normalizeProviderFilter(record.provider);
    if (provider) params.set("provider", provider);
    if (record.guildId) params.set("guildId", record.guildId);
    return `/dashboard/admin/integration-health?${params.toString()}`;
}

function buildAuditHref(event: AuditEventEntry): string {
    const params = new URLSearchParams({ status: "failure" });
    if (event.action.trim()) params.set("action", event.action.trim());
    if (event.action.startsWith("riot.")) {
        params.set("scope", "integrations");
        params.set("provider", "riot");
    }
    if (event.guildId) params.set("guildId", event.guildId);
    if (event.severity) params.set("severity", event.severity);
    return `/dashboard/admin/audit?${params.toString()}`;
}

function buildJobHref(name: string, result?: "failed"): string {
    const params = new URLSearchParams();
    const jobName = name.trim();
    if (jobName) params.set("job", jobName);
    if (result) params.set("result", result);
    const query = params.toString();
    return query ? `/dashboard/admin/jobs?${query}` : "/dashboard/admin/jobs";
}

function normalizeProviderFilter(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "patchnote" || normalized === "patchnotes") return "patchnotes";
    if (normalized === "birthdays") return "birthday";
    return normalized;
}

function formatProviderLabel(value: string, locale: DashboardLocale): string {
    const trimmed = value.trim();
    return trimmed.length > 0
        ? trimmed
        : reviewMessage(locale, "admin.helperCopy.reviewQueue.unknownProvider");
}

function getHealthStatusLabel(status: IntegrationHealthStatus, locale: DashboardLocale): string {
    return reviewMessage(locale, `admin.helperCopy.reviewQueue.healthStatuses.${status}`);
}

function formatAuditActor(event: AuditEventEntry): string {
    return event.actorId ? `${event.actorType}:${event.actorId}` : event.actorType;
}

function formatAuditTarget(event: AuditEventEntry): string {
    return event.targetId ? `${event.targetType}:${event.targetId}` : event.targetType;
}

function formatAuditFailureTitle(event: AuditEventEntry, locale: DashboardLocale): string {
    return event.action === "riot.leagueForm"
        ? reviewMessage(locale, "admin.helperCopy.reviewQueue.auditRiotTitle")
        : reviewMessage(locale, "admin.helperCopy.reviewQueue.auditTitle", { action: event.action });
}

function formatAuditFailureDetail(event: AuditEventEntry, locale: DashboardLocale): string {
    const baseDetail = `${formatAuditActor(event)} -> ${formatAuditTarget(event)}`;
    if (event.action !== "riot.leagueForm") return baseDetail;

    const metadata = buildAdminAuditMetadataView(event.metadata, locale);
    return metadata.hasMetadata ? `${baseDetail} - ${metadata.summary}` : baseDetail;
}

function normalizeIdPart(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function getTimestampMs(value: string | null | undefined): number {
    if (!value) return 0;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}
