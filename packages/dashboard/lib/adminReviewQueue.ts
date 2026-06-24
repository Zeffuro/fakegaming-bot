import type { AdminOperationsHealth, AdminOperationsHealthIssue } from "@/lib/adminOperationsHealth";
import { formatAdminProviderCooldownSummary, getAdminProviderCooldownHint } from "@/lib/adminProviderCooldown";
import { formatAdminProviderPlaybookSummary, getAdminProviderPlaybookHint } from "@/lib/adminProviderPlaybooks";
import type { AuditEventEntry, IntegrationHealthRecord, IntegrationHealthStatus, JobRunEntry } from "@/lib/api-client";

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

export function buildAdminReviewQueue(input: BuildAdminReviewQueueInput): AdminReviewQueueItem[] {
    const operationsItems = buildOperationsItems(input.operationsHealth?.issues ?? []);
    const healthItems = buildHealthItems(input.healthRecords ?? []);
    const jobItems = buildJobItems(input.jobs ?? []);
    const items: AdminReviewQueueItem[] = [
        ...groupOperationsWithDetails(operationsItems, healthItems, jobItems),
        ...buildAuditItems(input.auditEvents ?? []),
    ];
    const limit = Number.isInteger(input.limit) && input.limit !== undefined ? Math.max(0, input.limit) : defaultLimit;
    return items.sort(compareReviewItems).slice(0, limit);
}

function groupOperationsWithDetails(
    operationsItems: AdminReviewQueueItem[],
    healthItems: AdminReviewQueueItem[],
    jobItems: AdminReviewQueueItem[],
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
            detail: formatGroupedOperationsDetail(item, relatedItems),
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

function formatGroupedOperationsDetail(item: AdminReviewQueueItem, relatedItems: AdminReviewQueueRelatedItem[]): string {
    const relatedCount = relatedItems.length;
    const extraCount = Math.max(0, getOperationIssueValue(item) - relatedCount);
    const visibleText = relatedCount === 1
        ? "1 visible detail"
        : `${relatedCount} visible details`;
    const extraText = extraCount > 0 ? `, plus ${extraCount} more summarized by the overview` : "";
    return `${item.detail} Includes ${visibleText}${extraText}.`;
}

function getOperationIssueValue(item: AdminReviewQueueItem): number {
    const match = item.detail.match(/^(\d+)/);
    return match ? Number(match[1]) : 0;
}

function getLatestRelatedTimestamp(relatedItems: AdminReviewQueueRelatedItem[]): string | null {
    const sorted = [...relatedItems].sort((left, right) => getTimestampMs(right.timestamp) - getTimestampMs(left.timestamp));
    return sorted[0]?.timestamp ?? null;
}

function buildOperationsItems(issues: AdminOperationsHealthIssue[]): AdminReviewQueueItem[] {
    return issues.map(issue => ({
        id: `operations:${normalizeIdPart(issue.label)}`,
        title: issue.label,
        detail: formatOperationsIssueDetail(issue),
        severity: issue.severity,
        source: "operations",
        href: issue.href ?? "/dashboard/admin",
    }));
}

function buildHealthItems(records: IntegrationHealthRecord[]): AdminReviewQueueItem[] {
    return records
        .filter(record => actionableHealthStatuses.has(record.status))
        .map(record => {
            const failures = Math.max(0, record.consecutiveFailures);
            const issue = record.lastErrorMessage ?? record.lastErrorCode ?? getHealthStatusLabel(record.status);
            const failureText = failures > 0
                ? `${failures} consecutive ${pluralize("failure", failures)}`
                : "No consecutive failures recorded";
            const cooldownSummary = formatAdminProviderCooldownSummary(getAdminProviderCooldownHint(record));
            const playbookSummary = formatAdminProviderPlaybookSummary(getAdminProviderPlaybookHint(record));

            return {
                id: `integration-health:${record.provider}:${record.configId}`,
                title: `${formatProviderLabel(record.provider)} config ${record.configId}`,
                detail: [issue, failureText, cooldownSummary, playbookSummary].filter(Boolean).join(" - "),
                severity: record.status === "error" ? "critical" : "warning",
                source: "integration-health",
                href: buildIntegrationHealthHref(record),
                timestamp: record.lastFailureAt ?? record.lastCheckedAt ?? record.updatedAt ?? record.createdAt ?? null,
            };
        });
}

function buildJobItems(jobs: AdminReviewQueueJob[]): AdminReviewQueueItem[] {
    const items: AdminReviewQueueItem[] = [];

    for (const job of jobs) {
        if (job.error) {
            items.push({
                id: `jobs:${job.name}:unavailable`,
                title: `${job.name} status unavailable`,
                detail: job.error,
                severity: "critical",
                source: "jobs",
                href: "/dashboard/admin/jobs",
            });
            continue;
        }

        const latestRunFailed = job.latestRun?.ok === false;
        if (job.failedRecentRuns <= 0 && !latestRunFailed) continue;

        const latestError = latestRunFailed && job.latestRun?.error ? ` - ${job.latestRun.error}` : "";
        items.push({
            id: `jobs:${job.name}:failed`,
            title: `${job.name} has failed runs`,
            detail: `${job.failedRecentRuns}/${job.totalRecentRuns} recent ${pluralize("run", job.totalRecentRuns)} failed${latestError}`,
            severity: "critical",
            source: "jobs",
            href: "/dashboard/admin/jobs",
            timestamp: job.latestRun?.finishedAt ?? null,
        });
    }

    return items;
}

function buildAuditItems(events: AuditEventEntry[]): AdminReviewQueueItem[] {
    return events
        .filter(event => event.status === "failure")
        .map(event => ({
            id: `audit:${event.id}`,
            title: `Audit failed: ${event.action}`,
            detail: `${formatAuditActor(event)} -> ${formatAuditTarget(event)}`,
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

function formatOperationsIssueDetail(issue: AdminOperationsHealthIssue): string {
    if (issue.label === "Integration errors") {
        return `${issue.value} integration ${pluralize("record", issue.value)} currently failing.`;
    }
    if (issue.label === "Failed job runs") {
        return `${issue.value} recent job ${pluralize("run", issue.value)} failed.`;
    }
    if (issue.label === "Job status unavailable") {
        return `${issue.value} job ${pluralize("status", issue.value, "statuses")} could not be loaded.`;
    }
    if (issue.label === "Stale worker heartbeat") {
        return `Worker heartbeat is ${issue.value}m old.`;
    }
    if (issue.label === "Health warnings") {
        return `${issue.value} provider health ${pluralize("warning", issue.value)} or unknown states.`;
    }
    if (issue.label === "Missing worker heartbeat") {
        return "The worker has not reported a heartbeat yet.";
    }
    if (issue.label === "Partial overview data") {
        return "One or more admin overview requests failed.";
    }

    return `${issue.value} ${issue.label.toLowerCase()} ${pluralize("signal", issue.value)}.`;
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
    if (event.guildId) params.set("guildId", event.guildId);
    if (event.severity) params.set("severity", event.severity);
    return `/dashboard/admin/audit?${params.toString()}`;
}

function normalizeProviderFilter(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "patchnote" || normalized === "patchnotes") return "patchnotes";
    if (normalized === "birthdays") return "birthday";
    return normalized;
}

function formatProviderLabel(value: string): string {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "Unknown provider";
}

function getHealthStatusLabel(status: IntegrationHealthStatus): string {
    if (status === "error") return "Integration is failing";
    if (status === "warning") return "Integration has warnings";
    if (status === "unknown") return "Integration status is unknown";
    return `Integration status is ${status}`;
}

function formatAuditActor(event: AuditEventEntry): string {
    return event.actorId ? `${event.actorType}:${event.actorId}` : event.actorType;
}

function formatAuditTarget(event: AuditEventEntry): string {
    return event.targetId ? `${event.targetType}:${event.targetId}` : event.targetType;
}

function normalizeIdPart(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function getTimestampMs(value: string | null | undefined): number {
    if (!value) return 0;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function pluralize(label: string, value: number, plural = `${label}s`): string {
    return value === 1 ? label : plural;
}
