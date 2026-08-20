"use client";

import React from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { BarChart } from "@mui/icons-material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import type { RiotLeagueFormAuditSummary as RiotLeagueFormAuditSummaryModel } from "@/lib/adminRiotLeagueFormAudit";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface RiotLeagueFormAuditSummaryProps {
    summary: RiotLeagueFormAuditSummaryModel | null;
}

export function RiotLeagueFormAuditSummary({ summary }: RiotLeagueFormAuditSummaryProps) {
    const { t, formatNumber } = useDashboardI18n();
    if (!summary) return null;

    const accent = dashboardAccents.admin;

    return (
        <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
            <Stack spacing={1.6} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={1.1} sx={{ alignItems: "center" }}>
                        <BarChart sx={{ color: accent, fontSize: 22 }} />
                        <Box>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.1 }}>
                                {t("admin.auditRiotSummary")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
                                {t(summary.total === 1 ? "admin.auditLoadedEventOne" : "admin.auditLoadedEventMany", {
                                    count: formatNumber(summary.total),
                                })}
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                        <SummaryChip label={t("admin.auditSuccessCount", { count: formatNumber(summary.successes) })} accent={dashboardAccents.settings} />
                        <SummaryChip label={t("admin.auditFailureCount", { count: formatNumber(summary.failures) })} accent={dashboardAccents.quotes} />
                        <SummaryChip label={t("admin.auditWarningCount", { count: formatNumber(summary.warnings) })} accent={dashboardAccents.birthdays} />
                    </Stack>
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
                    <SummaryMetric label={t("admin.auditCacheHits")} value={formatNumber(summary.cacheHits)} />
                    <SummaryMetric label={t("admin.auditCacheMisses")} value={formatNumber(summary.cacheMisses)} />
                    <SummaryMetric label={t("admin.auditCacheBypasses")} value={formatNumber(summary.cacheBypasses)} />
                    <SummaryMetric label={t("admin.auditLiveAttempts")} value={formatNumber(summary.liveAttempts)} />
                    <SummaryMetric label={t("admin.auditRefreshRequests")} value={formatNumber(summary.refreshRequests)} />
                    <SummaryMetric label={t("admin.auditPartial")} value={formatNumber(summary.partials)} />
                    <SummaryMetric label={t("admin.auditEmptyHistory")} value={formatNumber(summary.emptyHistory)} />
                    <SummaryMetric label={t("admin.auditDetailFailureCount")} value={formatNumber(summary.detailFailures)} />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                    <CountStrip
                        label={t("admin.auditOutcomes")}
                        rows={summary.outcomes.map(row => ({ ...row, label: localizeOutcome(t, row.label) }))}
                        emptyLabel={t("admin.auditNoOutcomes")}
                        formatNumber={formatNumber}
                    />
                    <CountStrip
                        label={t("admin.auditErrorCategories")}
                        rows={summary.errorCategories.map(row => ({ ...row, label: localizeErrorCategory(t, row.label) }))}
                        emptyLabel={t("admin.auditNoErrorCategories")}
                        formatNumber={formatNumber}
                    />
                </Box>
            </Stack>
        </FeaturePanel>
    );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", p: 1.2, minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.44)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
                {label}
            </Typography>
            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.2 }}>
                {value}
            </Typography>
        </Box>
    );
}

function CountStrip({
    label,
    rows,
    emptyLabel,
    formatNumber,
}: {
    label: string;
    rows: { label: string; count: number }[];
    emptyLabel: string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
    return (
        <Box sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", p: 1.2, minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.44)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, mb: 0.8 }}>
                {label}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                {rows.length > 0 ? rows.map(row => (
                    <SummaryChip key={row.label} label={`${row.label}: ${formatNumber(row.count)}`} accent={dashboardAccents.admin} />
                )) : (
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
                        {emptyLabel}
                    </Typography>
                )}
            </Stack>
        </Box>
    );
}

function SummaryChip({ label, accent }: { label: string; accent: string }) {
    return (
        <Chip
            size="small"
            label={label}
            sx={{
                bgcolor: alpha(accent, 0.14),
                color: "grey.50",
                border: `1px solid ${alpha(accent, 0.32)}`,
                maxWidth: "100%",
                "& .MuiChip-label": { overflowWrap: "anywhere", whiteSpace: "normal" },
            }}
        />
    );
}

function localizeOutcome(t: ReturnType<typeof useDashboardI18n>["t"], value: string): string {
    switch (value) {
        case "cache_hit": return t("admin.auditOutcomeCacheHit");
        case "live_success": return t("admin.auditOutcomeLiveSuccess");
        case "missing_identity": return t("admin.auditOutcomeMissingIdentity");
        case "identity_failure": return t("admin.auditOutcomeIdentityFailure");
        case "history_failure": return t("admin.auditOutcomeHistoryFailure");
        case "empty_history": return t("admin.auditOutcomeEmptyHistory");
        case "live_partial": return t("admin.auditOutcomeLivePartial");
        case "malformed_history": return t("admin.auditOutcomeMalformedHistory");
        case "detail_failure": return t("admin.auditOutcomeDetailFailure");
        case "unsupported_region": return t("admin.auditOutcomeUnsupportedRegion");
        default: return value;
    }
}

function localizeErrorCategory(t: ReturnType<typeof useDashboardI18n>["t"], value: string): string {
    switch (value) {
        case "unknown": return t("admin.auditErrorUnknown");
        case "missing_key": return t("admin.auditErrorMissingKey");
        case "rate_limited": return t("admin.auditErrorRateLimited");
        case "not_found": return t("admin.auditErrorNotFound");
        case "malformed_data": return t("admin.auditErrorMalformedData");
        case "provider_error": return t("admin.auditErrorProvider");
        default: return value;
    }
}
