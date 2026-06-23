"use client";

import React from "react";
import Link from "next/link";
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    LinearProgress,
    Stack,
    Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    CheckCircle,
    ErrorOutlined,
    History,
    MonitorHeart,
    NotificationsActive,
    Refresh,
    WarningAmber,
    WorkHistory,
} from "@mui/icons-material";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useAdminCards } from "@/components/hooks/useAdmin";
import { useAdminOverview, type AdminOverviewJobStatus } from "@/components/hooks/useAdminOverview";
import { buildAdminOperationsHealth, type AdminOperationsHealth, type AdminOperationsStatus } from "@/lib/adminOperationsHealth";
import { buildAdminProviderInsights, type AdminProviderInsight } from "@/lib/adminProviderInsights";
import { buildAdminReviewQueue, type AdminReviewQueueItem, type AdminReviewSeverity, type AdminReviewSource } from "@/lib/adminReviewQueue";
import type {
    AdminNotificationRecord,
    AuditEventEntry,
    IntegrationHealthRecord,
} from "@/lib/api-client";

const emptyHealthSummary = {
    total: 0,
    healthy: 0,
    warning: 0,
    error: 0,
    paused: 0,
    unknown: 0,
};

export function AdminOverview() {
    const cards = useAdminCards();
    const {
        integrationHealth,
        auditEvents,
        notifications,
        jobs,
        heartbeat,
        loading,
        error,
        refresh,
    } = useAdminOverview();
    const summary = integrationHealth?.summary ?? emptyHealthSummary;
    const jobFailures = jobs.reduce((count, job) => count + job.failedRecentRuns, 0);
    const providerInsights = buildAdminProviderInsights({
        healthRecords: integrationHealth?.records ?? [],
        notificationProviders: notifications?.summary.byProvider ?? [],
    });
    const operationsHealth = buildAdminOperationsHealth({
        integrationSummary: integrationHealth?.summary ?? null,
        jobs,
        heartbeat,
        overviewError: error,
    });
    const reviewQueue = buildAdminReviewQueue({
        operationsHealth,
        healthRecords: integrationHealth?.records ?? [],
        jobs,
        auditEvents,
    });

    return (
        <Stack spacing={2.5}>
            <FeaturePanel accent={dashboardAccents.admin} sx={{ p: 2.5 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ position: "relative", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0 }}>
                            Operations overview
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.60)", mt: 0.5 }}>
                            Quick read on provider health, worker state, recent deliveries, and admin activity.
                        </Typography>
                    </Box>
                    <Button variant="outlined" onClick={() => void refresh()} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(dashboardAccents.admin)}>
                        Refresh
                    </Button>
                </Stack>
                {loading && <LinearProgress sx={{ mt: 2, borderRadius: 999, bgcolor: "rgba(255,255,255,0.08)" }} />}
            </FeaturePanel>

            {error && (
                <Alert severity="warning" icon={<WarningAmber />} sx={{ bgcolor: alpha(dashboardAccents.patchNotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.patchNotes, 0.25)}` }}>
                    Some overview data could not be loaded: {error}
                </Alert>
            )}

            <OperationsHealthPanel health={operationsHealth} />

            <AdminReviewQueuePanel items={reviewQueue} />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
                <OverviewMetric label="Health errors" value={summary.error} accent={dashboardAccents.quotes} icon={<ErrorOutlined />} />
                <OverviewMetric label="Warnings" value={summary.warning + summary.unknown} accent={dashboardAccents.patchNotes} icon={<WarningAmber />} />
                <OverviewMetric label="Job failures" value={jobFailures} accent={jobFailures > 0 ? dashboardAccents.quotes : dashboardAccents.settings} icon={<WorkHistory />} />
                <OverviewMetric label="Deliveries tracked" value={notifications?.summary.total ?? 0} accent={dashboardAccents.commands} icon={<NotificationsActive />} />
            </Box>

            <ProviderInsightsPanel insights={providerInsights} />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
                <OverviewPanel
                    title="Integration trouble"
                    description="Current error records across providers."
                    icon={<MonitorHeart />}
                    accent={dashboardAccents.quotes}
                    href="/dashboard/admin/integration-health"
                    actionLabel="Open health"
                >
                    {integrationHealth?.records.length ? (
                        <Stack spacing={1.3}>
                            {integrationHealth.records.map(record => (
                                <IntegrationHealthRow key={`${record.provider}-${record.configId}`} record={record} />
                            ))}
                        </Stack>
                    ) : (
                        <EmptyState label="No failing integrations found." />
                    )}
                </OverviewPanel>

                <OverviewPanel
                    title="Worker state"
                    description="Recent job outcomes and the last heartbeat."
                    icon={<WorkHistory />}
                    accent={dashboardAccents.settings}
                    href="/dashboard/admin/jobs"
                    actionLabel="Open jobs"
                >
                    <Stack spacing={1.3}>
                        <InfoRow
                            primary={heartbeat ? `Heartbeat: ${heartbeat.backend}` : "No heartbeat recorded"}
                            secondary={heartbeat ? `received ${formatDateTime(heartbeat.receivedAt)}` : "The worker may not have reported yet."}
                            chipLabel={heartbeat ? "online signal" : "unknown"}
                            accent={heartbeat ? dashboardAccents.settings : dashboardAccents.neutral}
                        />
                        {jobs.length > 0 ? jobs.slice(0, 5).map(job => (
                            <JobRow key={job.name} job={job} />
                        )) : (
                            <EmptyState label="No jobs returned by the API." />
                        )}
                    </Stack>
                </OverviewPanel>

                <OverviewPanel
                    title="Recent deliveries"
                    description="Notification dedupe records from provider jobs."
                    icon={<NotificationsActive />}
                    accent={dashboardAccents.commands}
                >
                    <Stack spacing={1.3}>
                        {notifications?.summary.byProvider.length ? (
                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                                {notifications.summary.byProvider.map(item => (
                                    <Chip
                                        key={item.provider}
                                        size="small"
                                        label={`${item.provider}: ${item.count}`}
                                        sx={{ bgcolor: alpha(dashboardAccents.commands, 0.12), color: "grey.100", border: `1px solid ${alpha(dashboardAccents.commands, 0.22)}` }}
                                    />
                                ))}
                            </Stack>
                        ) : null}
                        {notifications?.records.length ? notifications.records.map(record => (
                            <NotificationRow key={record.id} record={record} />
                        )) : (
                            <EmptyState label="No notification deliveries recorded yet." />
                        )}
                    </Stack>
                </OverviewPanel>

                <OverviewPanel
                    title="Audit trail"
                    description="Latest admin or configuration mutations."
                    icon={<History />}
                    accent={dashboardAccents.admin}
                    href="/dashboard/admin/audit"
                    actionLabel="Open audit"
                >
                    {auditEvents.length > 0 ? (
                        <Stack spacing={1.3}>
                            {auditEvents.map(event => (
                                <AuditRow key={event.id} event={event} />
                            ))}
                        </Stack>
                    ) : (
                        <EmptyState label="No audit events returned." />
                    )}
                </OverviewPanel>
            </Box>

            <FeaturePanel accent={dashboardAccents.admin}>
                <Stack spacing={2} sx={{ position: "relative" }}>
                    <Stack spacing={0.5}>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0 }}>
                            Admin tools
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
                            Drill into focused tools when the overview points at something.
                        </Typography>
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                        {cards.map((card) => (
                            <FeatureCard
                                key={card.href}
                                title={card.title}
                                description={card.description}
                                icon={card.icon}
                                accent={dashboardAccents.admin}
                                href={card.href}
                                statusLabel="admin"
                                actionLabel="Open"
                            />
                        ))}
                    </Box>
                </Stack>
            </FeaturePanel>
        </Stack>
    );
}

function AdminReviewQueuePanel({ items }: { items: AdminReviewQueueItem[] }) {
    const criticalCount = items.filter(item => item.severity === "critical").length;
    const warningCount = items.filter(item => item.severity === "warning").length;
    const panelSeverity: AdminReviewSeverity = criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "info";
    const accent = getReviewSeverityAccent(panelSeverity);

    return (
        <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
            <Stack spacing={2} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={1.2} sx={{ minWidth: 0, alignItems: "center" }}>
                        <Box sx={{ color: accent, display: "grid", placeItems: "center" }}>
                            {getReviewSeverityIcon(panelSeverity, accent)}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                                Review queue
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                                Highest-priority admin signals from health checks, jobs, and audit failures.
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                        <Chip
                            size="small"
                            label={`${criticalCount} critical`}
                            sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.100", border: `1px solid ${alpha(dashboardAccents.quotes, 0.24)}` }}
                        />
                        <Chip
                            size="small"
                            label={`${warningCount} warning`}
                            sx={{ bgcolor: alpha(dashboardAccents.patchNotes, 0.12), color: "grey.100", border: `1px solid ${alpha(dashboardAccents.patchNotes, 0.24)}` }}
                        />
                    </Stack>
                </Stack>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                {items.length > 0 ? (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.35 }}>
                        {items.map(item => (
                            <AdminReviewQueueRow key={item.id} item={item} />
                        ))}
                    </Box>
                ) : (
                    <EmptyState label="No admin review items queued." />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function AdminReviewQueueRow({ item }: { item: AdminReviewQueueItem }) {
    const accent = getReviewSeverityAccent(item.severity);

    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", p: 1.35, minWidth: 0 }}>
            <Stack spacing={1.1}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 1 }}>
                    <Stack direction="row" spacing={0.85} sx={{ minWidth: 0, alignItems: "center" }}>
                        {getReviewSeverityIcon(item.severity, accent)}
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.44)", display: "block", mt: 0.15 }}>
                                {formatReviewSource(item.source)} - {item.timestamp ? formatDateTime(item.timestamp) : "current signal"}
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        size="small"
                        label={item.severity}
                        sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}`, flexShrink: 0 }}
                    />
                </Stack>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.60)", overflowWrap: "anywhere" }}>
                    {item.detail}
                </Typography>
                <Button component={Link} href={item.href} size="small" variant="outlined" sx={{ ...ghostActionButtonSx(accent), alignSelf: "flex-start" }}>
                    Review
                </Button>
            </Stack>
        </Box>
    );
}

function ProviderInsightsPanel({ insights }: { insights: AdminProviderInsight[] }) {
    return (
        <FeaturePanel accent={dashboardAccents.commands} sx={{ p: 2.5 }}>
            <Stack spacing={2} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={1.2} sx={{ minWidth: 0, alignItems: "center" }}>
                        <Box sx={{ color: dashboardAccents.commands, display: "grid", placeItems: "center" }}>
                            <NotificationsActive />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                                Provider drilldown
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                                Health errors and recent delivery volume grouped by provider.
                            </Typography>
                        </Box>
                    </Stack>
                    <Button component={Link} href="/dashboard/admin/notifications" size="small" variant="outlined" sx={ghostActionButtonSx(dashboardAccents.commands)}>
                        Open deliveries
                    </Button>
                </Stack>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                {insights.length > 0 ? (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 1.4 }}>
                        {insights.slice(0, 6).map((insight) => (
                            <ProviderInsightRow key={insight.providerKey} insight={insight} />
                        ))}
                    </Box>
                ) : (
                    <EmptyState label="No provider health or delivery activity returned yet." />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function ProviderInsightRow({ insight }: { insight: AdminProviderInsight }) {
    const accent = insight.state === "needs-review" ? dashboardAccents.quotes : dashboardAccents.commands;
    const chipLabel = insight.state === "needs-review" ? "needs review" : "active";
    const actionLabel = insight.state === "needs-review" ? "Open errors" : "Open deliveries";
    const icon = insight.state === "needs-review"
        ? <ErrorOutlined sx={{ color: accent, fontSize: 17 }} />
        : <NotificationsActive sx={{ color: accent, fontSize: 17 }} />;

    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", p: 1.35, minWidth: 0 }}>
            <Stack spacing={1.1}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Stack direction="row" spacing={0.8} sx={{ minWidth: 0, alignItems: "center" }}>
                        {icon}
                        <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {insight.provider}
                        </Typography>
                    </Stack>
                    <Chip
                        size="small"
                        label={chipLabel}
                        sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}`, flexShrink: 0 }}
                    />
                </Stack>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
                    {formatProviderInsightSummary(insight)}
                </Typography>
                <Button component={Link} href={insight.href} size="small" variant="outlined" sx={ghostActionButtonSx(accent)}>
                    {actionLabel}
                </Button>
            </Stack>
        </Box>
    );
}

function OperationsHealthPanel({ health }: { health: AdminOperationsHealth }) {
    const accent = getOperationsStatusAccent(health.status);
    const icon = getOperationsStatusIcon(health.status);

    return (
        <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
            <Stack spacing={2} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={1.4} sx={{ alignItems: "center", minWidth: 0 }}>
                        <Box sx={{ color: accent, display: "grid", placeItems: "center" }}>
                            {icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 920, lineHeight: 1.15 }}>
                                {health.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.60)", mt: 0.35 }}>
                                {health.description}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.45)", display: "block", mt: 0.35 }}>
                                {health.heartbeatAgeMinutes === null ? "Worker heartbeat age unknown." : `Worker heartbeat received ${health.heartbeatAgeMinutes}m ago.`}
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        label={health.status}
                        sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}`, fontWeight: 850, textTransform: "capitalize" }}
                    />
                </Stack>

                {health.issues.length > 0 && (
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                        {health.issues.map((issue) => (
                            issue.href ? (
                                <Button
                                    key={`${issue.label}-${issue.value}`}
                                    component={Link}
                                    href={issue.href}
                                    size="small"
                                    variant="outlined"
                                    sx={ghostActionButtonSx(getOperationsStatusAccent(issue.severity))}
                                >
                                    {issue.label}: {formatIssueValue(issue.label, issue.value)}
                                </Button>
                            ) : (
                                <Chip
                                    key={`${issue.label}-${issue.value}`}
                                    label={`${issue.label}: ${formatIssueValue(issue.label, issue.value)}`}
                                    size="small"
                                    sx={{
                                        bgcolor: alpha(getOperationsStatusAccent(issue.severity), 0.12),
                                        color: "grey.100",
                                        border: `1px solid ${alpha(getOperationsStatusAccent(issue.severity), 0.24)}`,
                                    }}
                                />
                            )
                        ))}
                    </Stack>
                )}
            </Stack>
        </FeaturePanel>
    );
}

function OverviewMetric({
    label,
    value,
    accent,
    icon,
}: {
    label: string;
    value: number;
    accent: string;
    icon: React.ReactNode;
}) {
    return (
        <FeaturePanel accent={accent} sx={{ p: 2.25 }}>
            <Stack direction="row" spacing={1.4} sx={{ position: "relative", alignItems: "center" }}>
                <Box sx={{ color: accent, display: "grid", placeItems: "center" }}>
                    {icon}
                </Box>
                <Box>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)", fontWeight: 850, letterSpacing: 0, textTransform: "uppercase" }}>
                        {label}
                    </Typography>
                    <Typography variant="h4" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0, lineHeight: 1.05 }}>
                        {value}
                    </Typography>
                </Box>
            </Stack>
        </FeaturePanel>
    );
}

function OverviewPanel({
    title,
    description,
    icon,
    accent,
    href,
    actionLabel,
    children,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    accent: string;
    href?: string;
    actionLabel?: string;
    children: React.ReactNode;
}) {
    return (
        <FeaturePanel accent={accent} sx={{ p: 2.5, minHeight: 310 }}>
            <Stack spacing={2} sx={{ position: "relative", height: "100%" }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                    <Stack direction="row" spacing={1.2} sx={{ minWidth: 0 }}>
                        <Box sx={{ mt: 0.25, color: accent, display: "grid", placeItems: "center" }}>
                            {icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                                {title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.4 }}>
                                {description}
                            </Typography>
                        </Box>
                    </Stack>
                    {href && (
                        <Button component={Link} href={href} size="small" variant="outlined" sx={ghostActionButtonSx(accent)}>
                            {actionLabel ?? "Open"}
                        </Button>
                    )}
                </Stack>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                <Box sx={{ flex: 1 }}>{children}</Box>
            </Stack>
        </FeaturePanel>
    );
}

function IntegrationHealthRow({ record }: { record: IntegrationHealthRecord }) {
    const message = record.lastErrorMessage ?? record.lastErrorCode ?? "No error message recorded";

    return (
        <InfoRow
            primary={`${record.provider} / ${record.configId}`}
            secondary={message}
            meta={`guild ${record.guildId ?? "unknown"} - checked ${formatDateTime(record.lastCheckedAt)}`}
            chipLabel={`x${Math.max(1, record.consecutiveFailures)}`}
            accent={dashboardAccents.quotes}
        />
    );
}

function JobRow({ job }: { job: AdminOverviewJobStatus }) {
    if (job.error) {
        return (
            <InfoRow
                primary={job.name}
                secondary={job.error}
                chipLabel="status unavailable"
                accent={dashboardAccents.patchNotes}
            />
        );
    }

    const latest = job.latestRun;
    const ok = latest?.ok ?? true;
    const secondary = latest
        ? `${ok ? "last success" : "last failure"} at ${formatDateTime(latest.finishedAt)}`
        : "No recent runs recorded";

    return (
        <InfoRow
            primary={job.name}
            secondary={secondary}
            meta={`${job.failedRecentRuns}/${job.totalRecentRuns} recent failures`}
            chipLabel={ok ? "ok" : "failed"}
            accent={ok ? dashboardAccents.settings : dashboardAccents.quotes}
        />
    );
}

function NotificationRow({ record }: { record: AdminNotificationRecord }) {
    return (
        <InfoRow
            primary={`${record.provider} / ${record.eventId}`}
            secondary={`guild ${record.guildId ?? "unknown"} - channel ${record.channelId ?? "unknown"}`}
            meta={`recorded ${formatDateTime(record.createdAt)}`}
            chipLabel={record.messageId ? "message saved" : "dedupe only"}
            accent={dashboardAccents.commands}
        />
    );
}

function AuditRow({ event }: { event: AuditEventEntry }) {
    const accent = event.status === "failure" ? dashboardAccents.quotes : dashboardAccents.admin;

    return (
        <InfoRow
            primary={event.action}
            secondary={`${event.actorType}${event.actorId ? `:${event.actorId}` : ""} -> ${event.targetType}${event.targetId ? `:${event.targetId}` : ""}`}
            meta={formatDateTime(event.timestamp)}
            chipLabel={event.status}
            accent={accent}
        />
    );
}

function InfoRow({
    primary,
    secondary,
    meta,
    chipLabel,
    accent,
}: {
    primary: string;
    secondary: string;
    meta?: string;
    chipLabel: string;
    accent: string;
}) {
    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", p: 1.35 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
                        <CheckCircle sx={{ color: accent, fontSize: 17 }} />
                        <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 820, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {primary}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {secondary}
                    </Typography>
                    {meta && (
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.42)", display: "block", mt: 0.3 }}>
                            {meta}
                        </Typography>
                    )}
                </Box>
                <Chip
                    size="small"
                    label={chipLabel}
                    sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}`, flexShrink: 0 }}
                />
            </Stack>
        </Box>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.035)", border: "1px dashed rgba(255,255,255,0.12)", p: 2 }}>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
                {label}
            </Typography>
        </Box>
    );
}

function getOperationsStatusAccent(status: AdminOperationsStatus): string {
    if (status === "critical") return dashboardAccents.quotes;
    if (status === "warning") return dashboardAccents.patchNotes;
    return dashboardAccents.settings;
}

function getOperationsStatusIcon(status: AdminOperationsStatus): React.ReactNode {
    if (status === "critical") return <ErrorOutlined />;
    if (status === "warning") return <WarningAmber />;
    return <CheckCircle />;
}

function getReviewSeverityAccent(severity: AdminReviewSeverity): string {
    if (severity === "critical") return dashboardAccents.quotes;
    if (severity === "warning") return dashboardAccents.patchNotes;
    return dashboardAccents.settings;
}

function getReviewSeverityIcon(severity: AdminReviewSeverity, accent: string): React.ReactNode {
    if (severity === "critical") return <ErrorOutlined sx={{ color: accent, fontSize: 17 }} />;
    if (severity === "warning") return <WarningAmber sx={{ color: accent, fontSize: 17 }} />;
    return <CheckCircle sx={{ color: accent, fontSize: 17 }} />;
}

function formatReviewSource(source: AdminReviewSource): string {
    if (source === "integration-health") return "Integration health";
    if (source === "jobs") return "Jobs";
    if (source === "audit") return "Audit";
    return "Operations";
}

function formatIssueValue(label: string, value: number): string {
    if (label === "Stale worker heartbeat") return `${value}m`;
    return String(value);
}

function formatProviderInsightSummary(insight: AdminProviderInsight): string {
    if (insight.healthErrors > 0) {
        const guilds = insight.affectedGuilds > 0 ? `${insight.affectedGuilds} ${pluralize("guild", insight.affectedGuilds)}` : "guild unknown";
        return `${insight.healthErrors} error ${pluralize("config", insight.healthErrors)} - ${insight.consecutiveFailures} current ${pluralize("failure", insight.consecutiveFailures)} - ${guilds} - ${insight.deliveries} ${pluralize("delivery", insight.deliveries)}`;
    }

    return `No visible health errors - ${insight.deliveries} recent ${pluralize("delivery", insight.deliveries)}`;
}

function pluralize(label: string, value: number): string {
    return value === 1 ? label : `${label}s`;
}

function formatDateTime(value?: string | null): string {
    if (!value) return "unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}
