"use client";

import React from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField, Typography } from "@mui/material";
import { Refresh, Tune } from "@mui/icons-material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import type { AuditEventsQuery, AuditEventScope, AuditEventSeverity, AuditEventStatus, AuditIntegrationProvider } from "@/lib/api/audit";

export type AuditFilterUpdater = <K extends keyof AuditEventsQuery>(key: K, value: AuditEventsQuery[K] | undefined) => void;

const AUDIT_PROVIDER_OPTIONS: AuditIntegrationProvider[] = ["twitch", "youtube", "tiktok", "bluesky", "anime", "patchnotes"];

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
                                Filters
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
                                {activeFilterCount === 0 ? "Showing newest audit events." : `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active.`}
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button variant="outlined" onClick={onRefresh} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
                            Refresh
                        </Button>
                        <Button variant="outlined" onClick={onClear} disabled={loading} sx={ghostActionButtonSx(accent)}>
                            Clear
                        </Button>
                    </Stack>
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 1.4 }}>
                    <FormControl sx={dashboardFieldSx(accent)}>
                        <InputLabel id="scope-filter-label">Category</InputLabel>
                        <Select
                            labelId="scope-filter-label"
                            label="Category"
                            value={filters.scope ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => updateScope((e.target.value || undefined) as AuditEventScope | undefined)}
                        >
                            <MenuItem value="">All events</MenuItem>
                            <MenuItem value="integrations">Integrations</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={dashboardFieldSx(accent)}>
                        <InputLabel id="provider-filter-label">Provider</InputLabel>
                        <Select
                            labelId="provider-filter-label"
                            label="Provider"
                            value={filters.provider ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => updateProvider((e.target.value || undefined) as AuditIntegrationProvider | undefined)}
                        >
                            <MenuItem value="">Any</MenuItem>
                            {AUDIT_PROVIDER_OPTIONS.map(provider => (
                                <MenuItem key={provider} value={provider}>{provider}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Action"
                        value={filters.action ?? ""}
                        onChange={(e) => onUpdateFilter("action", e.target.value.trim() || undefined)}
                        placeholder="job.run"
                        sx={dashboardFieldSx(accent)}
                    />
                    <TextField
                        label="Target type"
                        value={filters.targetType ?? ""}
                        onChange={(e) => onUpdateFilter("targetType", e.target.value.trim() || undefined)}
                        placeholder="birthday"
                        sx={dashboardFieldSx(accent)}
                    />
                    <TextField
                        label="Actor ID"
                        value={filters.actorId ?? ""}
                        onChange={(e) => onUpdateFilter("actorId", e.target.value.trim() || undefined)}
                        sx={dashboardFieldSx(accent)}
                    />
                    <TextField
                        label="Guild ID"
                        value={filters.guildId ?? ""}
                        onChange={(e) => onUpdateFilter("guildId", e.target.value.trim() || undefined)}
                        sx={dashboardFieldSx(accent)}
                    />
                    <FormControl sx={dashboardFieldSx(accent)}>
                        <InputLabel id="severity-filter-label">Severity</InputLabel>
                        <Select
                            labelId="severity-filter-label"
                            label="Severity"
                            value={filters.severity ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => onUpdateFilter("severity", (e.target.value || undefined) as AuditEventSeverity | undefined)}
                        >
                            <MenuItem value="">Any</MenuItem>
                            <MenuItem value="info">Info</MenuItem>
                            <MenuItem value="warn">Warn</MenuItem>
                            <MenuItem value="error">Error</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={dashboardFieldSx(accent)}>
                        <InputLabel id="status-filter-label">Status</InputLabel>
                        <Select
                            labelId="status-filter-label"
                            label="Status"
                            value={filters.status ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => onUpdateFilter("status", (e.target.value || undefined) as AuditEventStatus | undefined)}
                        >
                            <MenuItem value="">Any</MenuItem>
                            <MenuItem value="success">Success</MenuItem>
                            <MenuItem value="failure">Failure</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Stack>
        </FeaturePanel>
    );
}
