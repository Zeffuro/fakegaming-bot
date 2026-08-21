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
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
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
import {
    getDashboardIntlLocale,
    type DashboardLocale,
} from "@/lib/i18n/localeStore";
import { formatDashboardMessage } from "@/lib/i18n/messages";

const emptyHealthSummary = {
    total: 0,
    healthy: 0,
    warning: 0,
    error: 0,
    paused: 0,
    unknown: 0,
};

export function AdminOverview() {
    const { locale, t, formatNumber } = useDashboardI18n();
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
    }, locale);
    const reviewQueue = buildAdminReviewQueue({
        operationsHealth,
        healthRecords: integrationHealth?.records ?? [],
        jobs,
        auditEvents,
    }, locale);

    return (
        <Stack spacing={2.5}>
            <FeaturePanel accent={dashboardAccents.admin} sx={{ p: 2.5 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ position: "relative", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0 }}>
                            {t("admin.overviewTitle")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.60)", mt: 0.5 }}>
                            {t("admin.overviewDescription")}
                        </Typography>
                    </Box>
                    <Button variant="outlined" onClick={() => void refresh()} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(dashboardAccents.admin)}>
                        {t("admin.overviewRefresh")}
                    </Button>
                </Stack>
                {loading && <LinearProgress sx={{ mt: 2, borderRadius: 999, bgcolor: "rgba(255,255,255,0.08)" }} />}
            </FeaturePanel>

            {error && (
                <Alert severity="warning" icon={<WarningAmber />} sx={{ bgcolor: alpha(dashboardAccents.patchNotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.patchNotes, 0.25)}` }}>
                    {t("admin.overviewPartialError", { error })}
                </Alert>
            )}

            <OperationsHealthPanel health={operationsHealth} />

            <AdminReviewQueuePanel items={reviewQueue} />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
                <OverviewMetric label={t("admin.overviewHealthErrors")} value={summary.error} accent={dashboardAccents.quotes} icon={<ErrorOutlined />} />
                <OverviewMetric label={t("admin.overviewWarnings")} value={summary.warning + summary.unknown} accent={dashboardAccents.patchNotes} icon={<WarningAmber />} />
                <OverviewMetric label={t("admin.overviewJobFailures")} value={jobFailures} accent={jobFailures > 0 ? dashboardAccents.quotes : dashboardAccents.settings} icon={<WorkHistory />} />
                <OverviewMetric label={t("admin.overviewDeliveriesTracked")} value={notifications?.summary.total ?? 0} accent={dashboardAccents.commands} icon={<NotificationsActive />} />
            </Box>

            <ProviderInsightsPanel insights={providerInsights} />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
                <OverviewPanel
                    title={t("admin.overviewIntegrationTrouble")}
                    description={t("admin.overviewIntegrationDescription")}
                    icon={<MonitorHeart />}
                    accent={dashboardAccents.quotes}
                    href="/dashboard/admin/integration-health"
                    actionLabel={t("admin.overviewOpenHealth")}
                >
                    {integrationHealth?.records.length ? (
                        <Stack spacing={1.3}>
                            {integrationHealth.records.map(record => (
                                <IntegrationHealthRow key={`${record.provider}-${record.configId}`} record={record} />
                            ))}
                        </Stack>
                    ) : (
                        <EmptyState label={t("admin.overviewNoFailingIntegrations")} />
                    )}
                </OverviewPanel>

                <OverviewPanel
                    title={t("admin.overviewWorkerState")}
                    description={t("admin.overviewWorkerDescription")}
                    icon={<WorkHistory />}
                    accent={dashboardAccents.settings}
                    href="/dashboard/admin/jobs"
                    actionLabel={t("admin.overviewOpenJobs")}
                >
                    <Stack spacing={1.3}>
                        <InfoRow
                            primary={heartbeat ? t("admin.overviewHeartbeat", { backend: heartbeat.backend }) : t("admin.overviewNoHeartbeat")}
                            secondary={heartbeat ? t("admin.overviewHeartbeatReceived", { date: formatDateTime(heartbeat.receivedAt, locale) }) : t("admin.overviewWorkerMayNotReported")}
                            chipLabel={heartbeat ? t("admin.overviewOnlineSignal") : t("admin.overviewUnknown")}
                            accent={heartbeat ? dashboardAccents.settings : dashboardAccents.neutral}
                        />
                        {jobs.length > 0 ? jobs.slice(0, 5).map(job => (
                            <JobRow key={job.name} job={job} />
                        )) : (
                            <EmptyState label={t("admin.overviewNoJobs")} />
                        )}
                    </Stack>
                </OverviewPanel>

                <OverviewPanel
                    title={t("admin.overviewRecentDeliveries")}
                    description={t("admin.overviewDeliveriesDescription")}
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
                                        label={t("admin.overviewProviderCount", { provider: item.provider, count: formatNumber(item.count) })}
                                        sx={{ bgcolor: alpha(dashboardAccents.commands, 0.12), color: "grey.100", border: `1px solid ${alpha(dashboardAccents.commands, 0.22)}` }}
                                    />
                                ))}
                            </Stack>
                        ) : null}
                        {notifications?.records.length ? notifications.records.map(record => (
                            <NotificationRow key={record.id} record={record} />
                        )) : (
                            <EmptyState label={t("admin.overviewNoDeliveries")} />
                        )}
                    </Stack>
                </OverviewPanel>

                <OverviewPanel
                    title={t("admin.overviewAuditTrail")}
                    description={t("admin.overviewAuditDescription")}
                    icon={<History />}
                    accent={dashboardAccents.admin}
                    href="/dashboard/admin/audit"
                    actionLabel={t("admin.overviewOpenAudit")}
                >
                    {auditEvents.length > 0 ? (
                        <Stack spacing={1.3}>
                            {auditEvents.map(event => (
                                <AuditRow key={event.id} event={event} />
                            ))}
                        </Stack>
                    ) : (
                        <EmptyState label={t("admin.overviewNoAudit")} />
                    )}
                </OverviewPanel>
            </Box>

            <FeaturePanel accent={dashboardAccents.admin}>
                <Stack spacing={2} sx={{ position: "relative" }}>
                    <Stack spacing={0.5}>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0 }}>
                            {t("admin.overviewAdminTools")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
                            {t("admin.overviewAdminToolsDescription")}
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
                                statusLabel={t("admin.overviewAdminStatus")}
                                actionLabel={t("admin.overviewOpen")}
                            />
                        ))}
                    </Box>
                </Stack>
            </FeaturePanel>
        </Stack>
    );
}

function AdminReviewQueuePanel({ items }: { items: AdminReviewQueueItem[] }) {
    const { t, formatNumber } = useDashboardI18n();
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
                                {t("admin.overviewReviewQueue")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                                {t("admin.overviewReviewDescription")}
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                        <Chip
                            size="small"
                            label={t("admin.overviewCriticalCount", { count: formatNumber(criticalCount) })}
                            sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.100", border: `1px solid ${alpha(dashboardAccents.quotes, 0.24)}` }}
                        />
                        <Chip
                            size="small"
                            label={t("admin.overviewWarningCount", { count: formatNumber(warningCount) })}
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
                    <EmptyState label={t("admin.overviewNoReviewItems")} />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function AdminReviewQueueRow({ item }: { item: AdminReviewQueueItem }) {
    const { locale, t, formatNumber } = useDashboardI18n();
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
                                {formatReviewSource(item.source, locale)} - {item.timestamp ? formatDateTime(item.timestamp, locale) : t("admin.overviewCurrentSignal")}
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        size="small"
                        label={formatStatus(item.severity, locale)}
                        sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}`, flexShrink: 0 }}
                    />
                </Stack>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.60)", overflowWrap: "anywhere" }}>
                    {item.detail}
                </Typography>
                {item.relatedItems?.length ? (
                    <Stack spacing={0.8} sx={{ borderLeft: `2px solid ${alpha(accent, 0.42)}`, pl: 1.15 }}>
                        {item.relatedItems.slice(0, 3).map((relatedItem) => (
                            <AdminReviewQueueRelatedRow key={relatedItem.id} item={relatedItem} />
                        ))}
                        {item.relatedItems.length > 3 && (
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.44)" }}>
                                {t("admin.overviewMoreDetails", { count: formatNumber(item.relatedItems.length - 3) })}
                            </Typography>
                        )}
                    </Stack>
                ) : null}
                <Button component={Link} href={item.href} size="small" variant="outlined" sx={{ ...ghostActionButtonSx(accent), alignSelf: "flex-start" }}>
                    {t("admin.overviewReview")}
                </Button>
            </Stack>
        </Box>
    );
}

function AdminReviewQueueRelatedRow({ item }: { item: NonNullable<AdminReviewQueueItem["relatedItems"]>[number] }) {
    const { t } = useDashboardI18n();
    return (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 1, minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: "grey.100", fontWeight: 800, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", display: "block", overflowWrap: "anywhere" }}>
                    {item.detail}
                </Typography>
            </Box>
            <Button component={Link} href={item.href} size="small" variant="text" sx={{ color: "grey.200", minWidth: 0, px: 0.6, flexShrink: 0 }}>
                {t("admin.overviewOpen")}
            </Button>
        </Stack>
    );
}

function ProviderInsightsPanel({ insights }: { insights: AdminProviderInsight[] }) {
    const { t } = useDashboardI18n();
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
                                {t("admin.overviewProviderDrilldown")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                                {t("admin.overviewProviderDescription")}
                            </Typography>
                        </Box>
                    </Stack>
                    <Button component={Link} href="/dashboard/admin/notifications" size="small" variant="outlined" sx={ghostActionButtonSx(dashboardAccents.commands)}>
                        {t("admin.overviewOpenDeliveries")}
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
                    <EmptyState label={t("admin.overviewNoProviderActivity")} />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function ProviderInsightRow({ insight }: { insight: AdminProviderInsight }) {
    const { locale, t } = useDashboardI18n();
    const accent = insight.state === "needs-review" ? dashboardAccents.quotes : dashboardAccents.commands;
    const chipLabel = insight.state === "needs-review" ? t("admin.overviewNeedsReview") : t("admin.overviewActive");
    const actionLabel = insight.state === "needs-review" ? t("admin.overviewOpenErrors") : t("admin.overviewOpenDeliveries");
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
                    {formatProviderInsightSummary(insight, locale)}
                </Typography>
                <Button component={Link} href={insight.href} size="small" variant="outlined" sx={ghostActionButtonSx(accent)}>
                    {actionLabel}
                </Button>
            </Stack>
        </Box>
    );
}

function OperationsHealthPanel({ health }: { health: AdminOperationsHealth }) {
    const { locale, t, formatNumber } = useDashboardI18n();
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
                                {health.heartbeatAgeMinutes === null
                                    ? t("admin.overviewHeartbeatAgeUnknown")
                                    : t("admin.overviewHeartbeatAge", { minutes: formatNumber(health.heartbeatAgeMinutes) })}
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        label={formatStatus(health.status, locale)}
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
                                    {formatIssueLabel(issue.label, locale)}: {formatIssueValue(issue.label, issue.value, locale)}
                                </Button>
                            ) : (
                                <Chip
                                    key={`${issue.label}-${issue.value}`}
                                    label={`${formatIssueLabel(issue.label, locale)}: ${formatIssueValue(issue.label, issue.value, locale)}`}
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
    const { formatNumber } = useDashboardI18n();
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
                        {formatNumber(value)}
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
    const { t } = useDashboardI18n();

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
                            {actionLabel ?? t("common.open")}
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
    const { locale, t } = useDashboardI18n();
    const message = record.lastErrorMessage ?? record.lastErrorCode ?? t("admin.overviewNoErrorMessage");

    return (
        <InfoRow
            primary={`${record.provider} / ${record.configId}`}
            secondary={message}
            meta={t("admin.overviewHealthMeta", {
                guild: record.guildId ?? t("admin.overviewUnknown"),
                date: formatDateTime(record.lastCheckedAt, locale),
            })}
            chipLabel={`x${Math.max(1, record.consecutiveFailures)}`}
            accent={dashboardAccents.quotes}
        />
    );
}

function JobRow({ job }: { job: AdminOverviewJobStatus }) {
    const { locale, t, formatNumber } = useDashboardI18n();
    if (job.error) {
        return (
            <InfoRow
                primary={job.name}
                secondary={job.error}
                chipLabel={t("admin.overviewStatusUnavailable")}
                accent={dashboardAccents.patchNotes}
            />
        );
    }

    const latest = job.latestRun;
    const ok = latest?.ok ?? true;
    const secondary = latest
        ? t("admin.overviewLastRun", {
            result: ok ? t("admin.overviewLastSuccess") : t("admin.overviewLastFailure"),
            date: formatDateTime(latest.finishedAt, locale),
        })
        : t("admin.overviewNoRecentRuns");

    return (
        <InfoRow
            primary={job.name}
            secondary={secondary}
            meta={t("admin.overviewRecentFailures", {
                failed: formatNumber(job.failedRecentRuns),
                total: formatNumber(job.totalRecentRuns),
            })}
            chipLabel={ok ? t("admin.overviewOk") : t("admin.overviewFailed")}
            accent={ok ? dashboardAccents.settings : dashboardAccents.quotes}
        />
    );
}

function NotificationRow({ record }: { record: AdminNotificationRecord }) {
    const { locale, t } = useDashboardI18n();
    return (
        <InfoRow
            primary={`${record.provider} / ${record.eventId}`}
            secondary={t("admin.overviewNotificationMeta", {
                guild: record.guildId ?? t("admin.overviewUnknown"),
                channel: record.channelId ?? t("admin.overviewUnknown"),
            })}
            meta={t("admin.overviewRecorded", { date: formatDateTime(record.createdAt, locale) })}
            chipLabel={record.messageId ? t("admin.overviewMessageSaved") : t("admin.overviewDedupeOnly")}
            accent={dashboardAccents.commands}
        />
    );
}

function AuditRow({ event }: { event: AuditEventEntry }) {
    const { locale, t } = useDashboardI18n();
    const accent = event.status === "failure" ? dashboardAccents.quotes : dashboardAccents.admin;

    return (
        <InfoRow
            primary={event.action}
            secondary={`${event.actorType}${event.actorId ? `:${event.actorId}` : ""} -> ${event.targetType}${event.targetId ? `:${event.targetId}` : ""}`}
            meta={formatDateTime(event.timestamp, locale)}
            chipLabel={event.status === "failure" ? t("admin.auditStatusFailure") : t("admin.auditStatusSuccess")}
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

function formatReviewSource(source: AdminReviewSource, locale: DashboardLocale): string {
    if (source === "integration-health") return formatDashboardMessage(locale, "admin.overviewSourceHealth");
    if (source === "jobs") return formatDashboardMessage(locale, "admin.overviewSourceJobs");
    if (source === "audit") return formatDashboardMessage(locale, "admin.overviewSourceAudit");
    return formatDashboardMessage(locale, "admin.overviewSourceOperations");
}

function formatStatus(status: AdminOperationsStatus | AdminReviewSeverity, locale: DashboardLocale): string {
    if (status === "critical") return formatDashboardMessage(locale, "admin.overviewStatusCritical");
    if (status === "warning") return formatDashboardMessage(locale, "admin.overviewStatusWarning");
    if (status === "info") return formatDashboardMessage(locale, "admin.auditSeverityInfo");
    return formatDashboardMessage(locale, "admin.overviewStatusHealthy");
}

function formatIssueLabel(label: string, locale: DashboardLocale): string {
    if (label === "Integration errors") return formatDashboardMessage(locale, "admin.overviewIssueIntegrationErrors");
    if (label === "Failed job runs") return formatDashboardMessage(locale, "admin.overviewIssueFailedJobs");
    if (label === "Job status unavailable") return formatDashboardMessage(locale, "admin.overviewIssueJobUnavailable");
    if (label === "Stale worker heartbeat") return formatDashboardMessage(locale, "admin.overviewIssueStaleHeartbeat");
    if (label === "Health warnings") return formatDashboardMessage(locale, "admin.overviewIssueHealthWarnings");
    if (label === "Missing worker heartbeat") return formatDashboardMessage(locale, "admin.overviewIssueMissingHeartbeat");
    if (label === "Partial overview data") return formatDashboardMessage(locale, "admin.overviewIssuePartialData");
    return label;
}

function formatIssueValue(label: string, value: number, locale: DashboardLocale): string {
    const formatted = new Intl.NumberFormat(getDashboardIntlLocale(locale)).format(value);
    if (label === "Stale worker heartbeat") {
        return formatDashboardMessage(locale, "admin.overviewStaleHeartbeatValue", { value: formatted });
    }
    return formatted;
}

function formatProviderInsightSummary(insight: AdminProviderInsight, locale: DashboardLocale): string {
    const number = new Intl.NumberFormat(getDashboardIntlLocale(locale));
    if (insight.healthErrors > 0) {
        const guilds = insight.affectedGuilds === 1
            ? formatDashboardMessage(locale, "admin.overviewProviderGuildOne")
            : insight.affectedGuilds > 1
                ? formatDashboardMessage(locale, "admin.overviewProviderGuildMany", { count: number.format(insight.affectedGuilds) })
                : formatDashboardMessage(locale, "admin.overviewProviderGuildUnknown");
        return formatDashboardMessage(locale, "admin.overviewProviderErrors", {
            errors: number.format(insight.healthErrors),
            failures: number.format(insight.consecutiveFailures),
            guilds,
            deliveries: number.format(insight.deliveries),
        });
    }

    return formatDashboardMessage(locale, "admin.overviewProviderNoErrors", {
        deliveries: number.format(insight.deliveries),
    });
}

function formatDateTime(value: string | null | undefined, locale: DashboardLocale): string {
    if (!value) return formatDashboardMessage(locale, "admin.overviewDateUnknown");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(getDashboardIntlLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
