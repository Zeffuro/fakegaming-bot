"use client";

import React from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ManageSearch } from "@mui/icons-material";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { buildAdminAuditMetadataView } from "@/lib/adminAuditDetail";
import type { AuditEventEntry, AuditEventSeverity } from "@/lib/api/audit";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

function severityColor(severity: AuditEventSeverity): string {
    if (severity === "error") return dashboardAccents.quotes;
    if (severity === "warn") return dashboardAccents.birthdays;
    return dashboardAccents.settings;
}

function targetLabel(event: AuditEventEntry): string {
    return event.targetId ? `${event.targetType}:${event.targetId}` : event.targetType;
}

function localizeSeverity(t: ReturnType<typeof useDashboardI18n>["t"], severity: AuditEventSeverity): string {
    if (severity === "error") return t("admin.auditSeverityError");
    if (severity === "warn") return t("admin.auditSeverityWarning");
    return t("admin.auditSeverityInfo");
}

export function AuditEventCard({ event, onInspect }: { event: AuditEventEntry; onInspect: (event: AuditEventEntry) => void }) {
    const { locale, t, formatDate } = useDashboardI18n();
    const color = severityColor(event.severity);
    const metadata = buildAdminAuditMetadataView(event.metadata, locale);

    return (
        <Box sx={{ borderRadius: 3, p: 1.6, bgcolor: "rgba(255,255,255,0.045)", border: `1px solid ${alpha(color, 0.22)}` }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, mb: 1.3 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Chip size="small" label={localizeSeverity(t, event.severity)} sx={{ bgcolor: alpha(color, 0.14), color: "grey.50", border: `1px solid ${alpha(color, 0.38)}`, textTransform: "uppercase", fontWeight: 800 }} />
                    <Chip size="small" label={event.status === "success" ? t("admin.auditStatusSuccess") : t("admin.auditStatusFailure")} sx={{ bgcolor: event.status === "success" ? alpha(dashboardAccents.settings, 0.12) : alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: "1px solid rgba(255,255,255,0.09)" }} />
                    <Typography variant="subtitle1" sx={{ color: "grey.50", fontWeight: 850 }}>
                        {event.action}
                    </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.54)", fontWeight: 700 }}>
                    {formatDateTime(event.timestamp, formatDate)}
                </Typography>
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
                <AuditDetail label={t("admin.auditActor")} value={event.actorId ? `${event.actorType}:${event.actorId}` : event.actorType} />
                <AuditDetail label={t("admin.auditTarget")} value={targetLabel(event)} />
                <AuditDetail label={t("admin.auditGuild")} value={event.guildId ?? t("common.none")} />
                <AuditDetail label={t("admin.auditRequest")} value={event.requestId ?? t("common.none")} />
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", mt: 1.25 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.50)", overflowWrap: "anywhere" }}>
                    {metadata.summary}
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onInspect(event)}
                    startIcon={<ManageSearch />}
                    sx={ghostActionButtonSx(color)}
                >
                    {t("admin.auditInspect")}
                </Button>
            </Stack>
        </Box>
    );
}

function AuditDetail({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.42)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", fontWeight: 700, overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
    );
}

function formatDateTime(
    value: string,
    formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string,
): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatDate(date, { dateStyle: "medium", timeStyle: "short" });
}
