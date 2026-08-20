import { getDashboardLocaleValue, type DashboardLocale, type DashboardLocaleValues } from "@/lib/i18n/localeStore";

export type AdminOperationsStatus = "healthy" | "warning" | "critical";

export interface AdminOperationsHealthSummary {
    total: number;
    healthy: number;
    warning: number;
    error: number;
    paused: number;
    unknown: number;
}

export interface AdminOperationsHealthJob {
    failedRecentRuns: number;
    error?: string;
}

export interface AdminOperationsHeartbeat {
    receivedAt: string;
}

export interface AdminOperationsHealthIssue {
    label: string;
    value: number;
    severity: Exclude<AdminOperationsStatus, "healthy">;
    href?: string;
}

export interface AdminOperationsHealth {
    status: AdminOperationsStatus;
    title: string;
    description: string;
    issues: AdminOperationsHealthIssue[];
    heartbeatAgeMinutes: number | null;
}

const staleHeartbeatMinutes = 10;

const statusCopy = {
    en: {
        critical: {
            title: "Attention Needed",
            description: "One or more operational signals need immediate review.",
        },
        warning: {
            title: "Monitor Closely",
            description: "No critical failures detected, but some signals need follow-up.",
        },
        healthy: {
            title: "Healthy",
            description: "No current integration, job, or heartbeat issues detected.",
        },
    },
    nl: {
        critical: {
            title: "Aandacht vereist",
            description: "Een of meer operationele signalen moeten direct worden beoordeeld.",
        },
        warning: {
            title: "Nauwlettend volgen",
            description: "Er zijn geen kritieke fouten, maar enkele signalen moeten worden opgevolgd.",
        },
        healthy: {
            title: "Gezond",
            description: "Er zijn momenteel geen problemen met integraties, taken of de heartbeat.",
        },
    },
} satisfies DashboardLocaleValues<Record<AdminOperationsStatus, { title: string; description: string }>>;

export function buildAdminOperationsHealth(input: {
    integrationSummary?: AdminOperationsHealthSummary | null;
    jobs?: AdminOperationsHealthJob[];
    heartbeat?: AdminOperationsHeartbeat | null;
    overviewError?: string | null;
    now?: Date;
}, locale: DashboardLocale = "en"): AdminOperationsHealth {
    const now = input.now ?? new Date();
    const summary = input.integrationSummary ?? {
        total: 0,
        healthy: 0,
        warning: 0,
        error: 0,
        paused: 0,
        unknown: 0,
    };
    const jobs = input.jobs ?? [];
    const failedJobRuns = jobs.reduce((count, job) => count + Math.max(0, job.failedRecentRuns), 0);
    const unavailableJobStatuses = jobs.filter((job) => Boolean(job.error)).length;
    const warningHealth = summary.warning + summary.unknown;
    const heartbeatAgeMinutes = getHeartbeatAgeMinutes(input.heartbeat, now);

    const issues: AdminOperationsHealthIssue[] = [];
    if (summary.error > 0) {
        issues.push({
            label: "Integration errors",
            value: summary.error,
            severity: "critical",
            href: "/dashboard/admin/integration-health?status=error",
        });
    }
    if (failedJobRuns > 0) {
        issues.push({
            label: "Failed job runs",
            value: failedJobRuns,
            severity: "critical",
            href: "/dashboard/admin/jobs?result=failed",
        });
    }
    if (unavailableJobStatuses > 0) {
        issues.push({
            label: "Job status unavailable",
            value: unavailableJobStatuses,
            severity: "critical",
            href: "/dashboard/admin/jobs",
        });
    }
    if (heartbeatAgeMinutes !== null && heartbeatAgeMinutes > staleHeartbeatMinutes) {
        issues.push({
            label: "Stale worker heartbeat",
            value: heartbeatAgeMinutes,
            severity: "critical",
            href: "/dashboard/admin/jobs",
        });
    }
    if (warningHealth > 0) {
        issues.push({
            label: "Health warnings",
            value: warningHealth,
            severity: "warning",
            href: "/dashboard/admin/integration-health?status=all",
        });
    }
    if (!input.heartbeat) {
        issues.push({
            label: "Missing worker heartbeat",
            value: 1,
            severity: "warning",
            href: "/dashboard/admin/jobs",
        });
    }
    if (input.overviewError) {
        issues.push({
            label: "Partial overview data",
            value: 1,
            severity: "warning",
        });
    }

    const status = issues.some((issue) => issue.severity === "critical")
        ? "critical"
        : issues.some((issue) => issue.severity === "warning")
            ? "warning"
            : "healthy";

    return {
        status,
        title: getStatusTitle(status, locale),
        description: getStatusDescription(status, locale),
        issues,
        heartbeatAgeMinutes,
    };
}

function getHeartbeatAgeMinutes(heartbeat: AdminOperationsHeartbeat | null | undefined, now: Date): number | null {
    if (!heartbeat) return null;
    const parsed = new Date(heartbeat.receivedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 60000));
}

function getStatusTitle(status: AdminOperationsStatus, locale: DashboardLocale): string {
    return getDashboardLocaleValue(locale, statusCopy)[status].title;
}

function getStatusDescription(status: AdminOperationsStatus, locale: DashboardLocale): string {
    return getDashboardLocaleValue(locale, statusCopy)[status].description;
}
