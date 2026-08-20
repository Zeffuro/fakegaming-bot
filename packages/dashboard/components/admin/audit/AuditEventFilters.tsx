"use client";

import React from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField, Typography } from "@mui/material";
import { Refresh, Tune } from "@mui/icons-material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import type { AuditEventsQuery, AuditEventScope, AuditEventSeverity, AuditEventStatus, AuditIntegrationProvider } from "@/lib/api/audit";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export type AuditFilterUpdater = <K extends keyof AuditEventsQuery>(key: K, value: AuditEventsQuery[K] | undefined) => void;

const AUDIT_PROVIDER_OPTIONS: AuditIntegrationProvider[] = ["twitch", "youtube", "tiktok", "riot", "bluesky", "anime", "patchnotes"];

interface AuditEventFiltersProps {
    filters: AuditEventsQuery;
    loading: boolean;
    activeFilterCount: number;
    onRefresh: () => void;
    onClear: () => void;
    onUpdateFilter: AuditFilterUpdater;
}

export function AuditEventFilters({
    filters,
    loading,
    activeFilterCount,
    onRefresh,
    onClear,
    onUpdateFilter,
}: AuditEventFiltersProps) {
    const { t, formatNumber } = useDashboardI18n();
    const accent = dashboardAccents.admin;
    const updateScope = (value: AuditEventScope | undefined) => {
        onUpdateFilter("scope", value);
    };

    const updateProvider = (value: AuditIntegrationProvider | undefined) => {
        onUpdateFilter("provider", value);
    };

    return (
        <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
            <Stack spacing={2.2} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" } }}>
                    <Stack direction="row" spacing={1.1} sx={{ alignItems: "center" }}>
                        <Tune sx={{ color: accent }} />
                        <Box>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.1 }}>
                                {t("admin.auditFilters")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
                                {activeFilterCount === 0
                                    ? t("admin.auditNewest")
                                    : t(activeFilterCount === 1 ? "admin.auditActiveFilterOne" : "admin.auditActiveFilterMany", {
                                        count: formatNumber(activeFilterCount),
                                    })}
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button variant="outlined" onClick={onRefresh} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
                            {t("common.refresh")}
                        </Button>
                        <Button variant="outlined" onClick={onClear} disabled={loading} sx={ghostActionButtonSx(accent)}>
                            {t("common.clear")}
                        </Button>
                    </Stack>
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 1.4 }}>
                    <FormControl sx={dashboardFieldSx(accent)}>
                        <InputLabel id="scope-filter-label">{t("admin.auditCategory")}</InputLabel>
                        <Select
                            labelId="scope-filter-label"
                            label={t("admin.auditCategory")}
                            value={filters.scope ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => updateScope((e.target.value || undefined) as AuditEventScope | undefined)}
                        >
                            <MenuItem value="">{t("admin.auditAllEvents")}</MenuItem>
                            <MenuItem value="integrations">{t("admin.auditIntegrations")}</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={dashboardFieldSx(accent)}>
                        <InputLabel id="provider-filter-label">{t("admin.auditProvider")}</InputLabel>
                        <Select
                            labelId="provider-filter-label"
                            label={t("admin.auditProvider")}
                            value={filters.provider ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => updateProvider((e.target.value || undefined) as AuditIntegrationProvider | undefined)}
                        >
                            <MenuItem value="">{t("admin.auditAny")}</MenuItem>
                            {AUDIT_PROVIDER_OPTIONS.map(provider => (
                                <MenuItem key={provider} value={provider}>{provider}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label={t("admin.auditAction")}
                        value={filters.action ?? ""}
                        onChange={(e) => onUpdateFilter("action", e.target.value.trim() || undefined)}
                        placeholder="job.run"
                        sx={dashboardFieldSx(accent)}
                    />
                    <TextField
                        label={t("admin.auditTargetType")}
                        value={filters.targetType ?? ""}
                        onChange={(e) => onUpdateFilter("targetType", e.target.value.trim() || undefined)}
                        placeholder="birthday"
                        sx={dashboardFieldSx(accent)}
                    />
                    <TextField
                        label={t("admin.auditActorId")}
                        value={filters.actorId ?? ""}
                        onChange={(e) => onUpdateFilter("actorId", e.target.value.trim() || undefined)}
                        sx={dashboardFieldSx(accent)}
                    />
                    <TextField
                        label={t("admin.auditGuildId")}
                        value={filters.guildId ?? ""}
                        onChange={(e) => onUpdateFilter("guildId", e.target.value.trim() || undefined)}
                        sx={dashboardFieldSx(accent)}
                    />
                    <FormControl sx={dashboardFieldSx(accent)}>
                        <InputLabel id="severity-filter-label">{t("admin.auditSeverity")}</InputLabel>
                        <Select
                            labelId="severity-filter-label"
                            label={t("admin.auditSeverity")}
                            value={filters.severity ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => onUpdateFilter("severity", (e.target.value || undefined) as AuditEventSeverity | undefined)}
                        >
                            <MenuItem value="">{t("admin.auditAny")}</MenuItem>
                            <MenuItem value="info">{t("admin.auditSeverityInfo")}</MenuItem>
                            <MenuItem value="warn">{t("admin.auditSeverityWarning")}</MenuItem>
                            <MenuItem value="error">{t("admin.auditSeverityError")}</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={dashboardFieldSx(accent)}>
                        <InputLabel id="status-filter-label">{t("admin.auditStatus")}</InputLabel>
                        <Select
                            labelId="status-filter-label"
                            label={t("admin.auditStatus")}
                            value={filters.status ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => onUpdateFilter("status", (e.target.value || undefined) as AuditEventStatus | undefined)}
                        >
                            <MenuItem value="">{t("admin.auditAny")}</MenuItem>
                            <MenuItem value="success">{t("admin.auditStatusSuccess")}</MenuItem>
                            <MenuItem value="failure">{t("admin.auditStatusFailure")}</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Stack>
        </FeaturePanel>
    );
}
