"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { DashboardMessageKey } from "@/lib/i18n/messages";
import {
    api,
    getAuditEvents,
    type AdminIntegrationHealthResponse,
    type AdminNotificationsResponse,
    type AuditEventEntry,
    type JobRunEntry,
    type JobsListResponse,
    type LastHeartbeatResponse,
} from "@/lib/api-client";

export interface AdminOverviewJobStatus {
    name: string;
    supportsDate: boolean;
    supportsForce: boolean;
    latestRun: JobRunEntry | null;
    failedRecentRuns: number;
    totalRecentRuns: number;
    error?: string;
}

export interface AdminOverviewState {
    integrationHealth: AdminIntegrationHealthResponse | null;
    auditEvents: AuditEventEntry[];
    notifications: AdminNotificationsResponse | null;
    jobs: AdminOverviewJobStatus[];
    heartbeat: LastHeartbeatResponse["last"];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

type JobInfo = JobsListResponse["jobs"][number];

export function useAdminOverview(): AdminOverviewState {
    const { t } = useDashboardI18n();
    const [integrationHealth, setIntegrationHealth] = useState<AdminIntegrationHealthResponse | null>(null);
    const [auditEvents, setAuditEvents] = useState<AuditEventEntry[]>([]);
    const [notifications, setNotifications] = useState<AdminNotificationsResponse | null>(null);
    const [jobs, setJobs] = useState<AdminOverviewJobStatus[]>([]);
    const [heartbeat, setHeartbeat] = useState<LastHeartbeatResponse["last"]>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        const errors: string[] = [];

        const [
            healthResult,
            auditResult,
            notificationsResult,
            jobsResult,
            heartbeatResult,
        ] = await Promise.allSettled([
            api.getAdminIntegrationHealth({ status: "error", limit: 6 }),
            getAuditEvents({ limit: 6 }),
            api.getAdminNotifications({ limit: 6 }),
            api.getJobs(),
            api.getLastHeartbeat(),
        ]);

        if (healthResult.status === "fulfilled") {
            setIntegrationHealth(healthResult.value);
        } else {
            errors.push(formatSettledError(t("admin.overviewErrorHealth"), healthResult.reason, t));
        }

        if (auditResult.status === "fulfilled") {
            setAuditEvents(auditResult.value.events);
        } else {
            errors.push(formatSettledError(t("admin.overviewErrorAudit"), auditResult.reason, t));
        }

        if (notificationsResult.status === "fulfilled") {
            setNotifications(notificationsResult.value);
        } else {
            errors.push(formatSettledError(t("admin.overviewErrorNotifications"), notificationsResult.reason, t));
        }

        if (heartbeatResult.status === "fulfilled") {
            setHeartbeat(heartbeatResult.value.last);
        } else {
            errors.push(formatSettledError(t("admin.overviewErrorHeartbeat"), heartbeatResult.reason, t));
        }

        if (jobsResult.status === "fulfilled") {
            const jobStatuses = await loadJobStatuses(jobsResult.value.jobs, t);
            setJobs(jobStatuses);
        } else {
            setJobs([]);
            errors.push(formatSettledError(t("admin.overviewErrorRegistry"), jobsResult.reason, t));
        }

        setError(errors.length > 0 ? errors.join(" / ") : null);
        setLoading(false);
    }, [t]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        integrationHealth,
        auditEvents,
        notifications,
        jobs,
        heartbeat,
        loading,
        error,
        refresh,
    };
}

type Translate = (key: DashboardMessageKey, values?: Record<string, string | number>) => string;

async function loadJobStatuses(jobInfos: JobInfo[], t: Translate): Promise<AdminOverviewJobStatus[]> {
    return await Promise.all(jobInfos.map(async (job) => {
        try {
            const status = await api.getJobStatus(job.name);
            const runs = status.runs ?? [];
            return {
                name: job.name,
                supportsDate: job.supportsDate,
                supportsForce: job.supportsForce,
                latestRun: runs[0] ?? null,
                failedRecentRuns: runs.filter(run => !run.ok).length,
                totalRecentRuns: runs.length,
            };
        } catch (err: unknown) {
            return {
                name: job.name,
                supportsDate: job.supportsDate,
                supportsForce: job.supportsForce,
                latestRun: null,
                failedRecentRuns: 0,
                totalRecentRuns: 0,
                error: err instanceof Error ? err.message : t("admin.overviewLoadStatusFailed"),
            };
        }
    }));
}

function formatSettledError(label: string, reason: unknown, t: Translate): string {
    const message = reason instanceof Error ? reason.message : t("admin.overviewErrorUnknown");
    return t("admin.overviewErrorItem", { label, message });
}
