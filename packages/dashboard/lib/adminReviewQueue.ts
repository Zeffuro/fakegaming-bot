import type { AdminOperationsHealth, AdminOperationsHealthIssue } from "@/lib/adminOperationsHealth";
import { buildAdminAuditMetadataView } from "@/lib/adminAuditDetail";
import { formatAdminProviderCooldownSummary, getAdminProviderCooldownHint } from "@/lib/adminProviderCooldown";
import { formatAdminProviderPlaybookSummary, getAdminProviderPlaybookHint } from "@/lib/adminProviderPlaybooks";
import type { AuditEventEntry, IntegrationHealthRecord, IntegrationHealthStatus, JobRunEntry } from "@/lib/api-client";
import { getDashboardLocaleValue, type DashboardLocale, type DashboardLocaleValues } from "@/lib/i18n/localeStore";

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

interface ReviewQueueCopy {
    groupedDetail: (detail: string, visibleCount: number, extraCount: number) => string;
    failureCount: (count: number) => string;
    noFailures: string;
    healthTitle: (provider: string, configId: string) => string;
    jobUnavailable: (name: string) => string;
    jobFailedTitle: (name: string) => string;
    jobFailedDetail: (failed: number, total: number, latestError: string) => string;
    issueTitles: Readonly<Record<string, string>>;
    issueDetails: Readonly<Record<string, (value: number) => string>>;
    fallbackIssueDetail: (value: number, label: string) => string;
    unknownProvider: string;
    healthStatuses: Readonly<Record<IntegrationHealthStatus, string>>;
    auditRiotTitle: string;
    auditTitle: (action: string) => string;
}

const reviewQueueCopy: DashboardLocaleValues<ReviewQueueCopy> = {
    en: {
        groupedDetail: (detail, visibleCount, extraCount) => {
            const visibleText = visibleCount === 1 ? "1 visible detail" : `${visibleCount} visible details`;
            const extraText = extraCount > 0 ? `, plus ${extraCount} more summarized by the overview` : "";
            return `${detail} Includes ${visibleText}${extraText}.`;
        },
        failureCount: (count) => `${count} consecutive ${pluralize("failure", count)}`,
        noFailures: "No consecutive failures recorded",
        healthTitle: (provider, configId) => `${provider} config ${configId}`,
        jobUnavailable: (name) => `${name} status unavailable`,
        jobFailedTitle: (name) => `${name} has failed runs`,
        jobFailedDetail: (failed, total, latestError) => `${failed}/${total} recent ${pluralize("run", total)} failed${latestError}`,
        issueTitles: {},
        issueDetails: {
            "Integration errors": (value) => `${value} integration ${pluralize("record", value)} currently failing.`,
            "Failed job runs": (value) => `${value} recent job ${pluralize("run", value)} failed.`,
            "Job status unavailable": (value) => `${value} job ${pluralize("status", value, "statuses")} could not be loaded.`,
            "Stale worker heartbeat": (value) => `Worker heartbeat is ${value}m old.`,
            "Health warnings": (value) => `${value} provider health ${pluralize("warning", value)} or unknown states.`,
            "Missing worker heartbeat": () => "The worker has not reported a heartbeat yet.",
            "Partial overview data": () => "One or more admin overview requests failed.",
        },
        fallbackIssueDetail: (value, label) => `${value} ${label.toLowerCase()} ${pluralize("signal", value)}.`,
        unknownProvider: "Unknown provider",
        healthStatuses: {
            error: "Integration is failing",
            warning: "Integration has warnings",
            unknown: "Integration status is unknown",
            healthy: "Integration status is healthy",
            paused: "Integration status is paused",
        },
        auditRiotTitle: "Audit failed: Riot League form",
        auditTitle: (action) => `Audit failed: ${action}`,
    },
    nl: {
        groupedDetail: (detail, visibleCount, extraCount) => {
            const visibleText = visibleCount === 1 ? "1 zichtbaar detail" : `${visibleCount} zichtbare details`;
            const extraText = extraCount > 0 ? `, plus ${extraCount} meer samengevat in het overzicht` : "";
            return `${detail} Bevat ${visibleText}${extraText}.`;
        },
        failureCount: (count) => `${count} opeenvolgende ${count === 1 ? "fout" : "fouten"}`,
        noFailures: "Geen opeenvolgende fouten vastgelegd",
        healthTitle: (provider, configId) => `${provider}-configuratie ${configId}`,
        jobUnavailable: (name) => `Status van ${name} niet beschikbaar`,
        jobFailedTitle: (name) => `${name} heeft mislukte uitvoeringen`,
        jobFailedDetail: (failed, total, latestError) => `${failed}/${total} recente ${total === 1 ? "uitvoering" : "uitvoeringen"} mislukt${latestError}`,
        issueTitles: {
            "Integration errors": "Integratiefouten",
            "Failed job runs": "Mislukte taakuitvoeringen",
            "Job status unavailable": "Taakstatus niet beschikbaar",
            "Stale worker heartbeat": "Verouderde workerheartbeat",
            "Health warnings": "Statuswaarschuwingen",
            "Missing worker heartbeat": "Workerheartbeat ontbreekt",
            "Partial overview data": "Onvolledige overzichtsgegevens",
        },
        issueDetails: {
            "Integration errors": (value) => `${value} ${value === 1 ? "integratierecord mislukt" : "integratierecords mislukken"} momenteel.`,
            "Failed job runs": (value) => `${value} recente ${value === 1 ? "taakuitvoering is" : "taakuitvoeringen zijn"} mislukt.`,
            "Job status unavailable": (value) => `${value} ${value === 1 ? "taakstatus kon" : "taakstatussen konden"} niet worden geladen.`,
            "Stale worker heartbeat": (value) => `De workerheartbeat is ${value} min oud.`,
            "Health warnings": (value) => `${value} ${value === 1 ? "statuswaarschuwing of onbekende status" : "statuswaarschuwingen of onbekende statussen"} van providers.`,
            "Missing worker heartbeat": () => "De worker heeft nog geen heartbeat gemeld.",
            "Partial overview data": () => "Een of meer aanvragen voor het beheeroverzicht zijn mislukt.",
        },
        fallbackIssueDetail: (value, label) => `${value} signalen: ${label.toLowerCase()}.`,
        unknownProvider: "Onbekende provider",
        healthStatuses: {
            error: "Integratie mislukt",
            warning: "Integratie heeft waarschuwingen",
            unknown: "Integratiestatus is onbekend",
            healthy: "Integratiestatus is healthy",
            paused: "Integratiestatus is paused",
        },
        auditRiotTitle: "Audit mislukt: Riot League-formulier",
        auditTitle: (action) => `Audit mislukt: ${action}`,
    },
};

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
    return getDashboardLocaleValue(locale, reviewQueueCopy).groupedDetail(item.detail, relatedCount, extraCount);
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
            const copy = getDashboardLocaleValue(locale, reviewQueueCopy);
            const failures = Math.max(0, record.consecutiveFailures);
            const issue = record.lastErrorMessage ?? record.lastErrorCode ?? getHealthStatusLabel(record.status, locale);
            const failureText = failures > 0
                ? copy.failureCount(failures)
                : copy.noFailures;
            const cooldownSummary = formatAdminProviderCooldownSummary(getAdminProviderCooldownHint(record, Date.now(), locale), locale);
            const playbookSummary = formatAdminProviderPlaybookSummary(getAdminProviderPlaybookHint(record, locale), locale);

            return {
                id: `integration-health:${record.provider}:${record.configId}`,
                title: copy.healthTitle(formatProviderLabel(record.provider, locale), record.configId),
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
    const copy = getDashboardLocaleValue(locale, reviewQueueCopy);

    for (const job of jobs) {
        if (job.error) {
            items.push({
                id: `jobs:${job.name}:unavailable`,
                title: copy.jobUnavailable(job.name),
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
            title: copy.jobFailedTitle(job.name),
            detail: copy.jobFailedDetail(job.failedRecentRuns, job.totalRecentRuns, latestError),
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
    return getDashboardLocaleValue(locale, reviewQueueCopy).issueTitles[label] ?? label;
}

function formatOperationsIssueDetail(issue: AdminOperationsHealthIssue, locale: DashboardLocale): string {
    const copy = getDashboardLocaleValue(locale, reviewQueueCopy);
    return copy.issueDetails[issue.label]?.(issue.value)
        ?? copy.fallbackIssueDetail(issue.value, issue.label);
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
    return trimmed.length > 0 ? trimmed : getDashboardLocaleValue(locale, reviewQueueCopy).unknownProvider;
}

function getHealthStatusLabel(status: IntegrationHealthStatus, locale: DashboardLocale): string {
    return getDashboardLocaleValue(locale, reviewQueueCopy).healthStatuses[status];
}

function formatAuditActor(event: AuditEventEntry): string {
    return event.actorId ? `${event.actorType}:${event.actorId}` : event.actorType;
}

function formatAuditTarget(event: AuditEventEntry): string {
    return event.targetId ? `${event.targetType}:${event.targetId}` : event.targetType;
}

function formatAuditFailureTitle(event: AuditEventEntry, locale: DashboardLocale): string {
    const copy = getDashboardLocaleValue(locale, reviewQueueCopy);
    return event.action === "riot.leagueForm" ? copy.auditRiotTitle : copy.auditTitle(event.action);
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

function pluralize(label: string, value: number, plural = `${label}s`): string {
    return value === 1 ? label : plural;
}
