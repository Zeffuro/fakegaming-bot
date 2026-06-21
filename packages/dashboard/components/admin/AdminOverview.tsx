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

    return (
        <Stack spacing={2.5}>
            <FeaturePanel accent={dashboardAccents.admin} sx={{ p: 2.5 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ position: "relative", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: "-0.04em" }}>
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

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
                <OverviewMetric label="Health errors" value={summary.error} accent={dashboardAccents.quotes} icon={<ErrorOutlined />} />
                <OverviewMetric label="Warnings" value={summary.warning + summary.unknown} accent={dashboardAccents.patchNotes} icon={<WarningAmber />} />
                <OverviewMetric label="Job failures" value={jobFailures} accent={jobFailures > 0 ? dashboardAccents.quotes : dashboardAccents.settings} icon={<WorkHistory />} />
                <OverviewMetric label="Deliveries tracked" value={notifications?.summary.total ?? 0} accent={dashboardAccents.commands} icon={<NotificationsActive />} />
            </Box>

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
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: "-0.04em" }}>
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
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {label}
                    </Typography>
                    <Typography variant="h4" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: "-0.05em", lineHeight: 1.05 }}>
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
            meta={`guild ${record.guildId ?? "unknown"} • checked ${formatDateTime(record.lastCheckedAt)}`}
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
            secondary={`guild ${record.guildId ?? "unknown"} • channel ${record.channelId ?? "unknown"}`}
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

function formatDateTime(value?: string | null): string {
    if (!value) return "unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}
