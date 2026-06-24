"use client";

import React from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, Typography } from "@mui/material";
import { Download, History, ShieldOutlined } from "@mui/icons-material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import type { AuditEventEntry } from "@/lib/api/audit";
import { AuditEventCard } from "./AuditEventCard";

interface AuditEventsListProps {
    events: AuditEventEntry[];
    total: number;
    limit: number;
    loading: boolean;
    canGoBack: boolean;
    canGoNext: boolean;
    onLimitChange: (limit: number) => void;
    onPrevious: () => void;
    onNext: () => void;
    onExport: () => void;
}

export function AuditEventsList({
    events,
    total,
    limit,
    loading,
    canGoBack,
    canGoNext,
    onLimitChange,
    onPrevious,
    onNext,
    onExport,
}: AuditEventsListProps) {
    const accent = dashboardAccents.admin;

    return (
        <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ position: "relative", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, mb: 2 }}>
                <Stack direction="row" spacing={1.1} sx={{ alignItems: "center" }}>
                    <History sx={{ color: accent }} />
                    <Box>
                        <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.1 }}>
                            Recent events
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
                            Showing {events.length} of {total} rows.
                        </Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                    <FormControl size="small" sx={{ ...dashboardFieldSx(accent), minWidth: 110 }}>
                        <InputLabel id="limit-filter-label">Rows</InputLabel>
                        <Select
                            labelId="limit-filter-label"
                            label="Rows"
                            value={String(limit)}
                            onChange={(e: SelectChangeEvent<string>) => onLimitChange(Number(e.target.value))}
                        >
                            <MenuItem value="25">25</MenuItem>
                            <MenuItem value="50">50</MenuItem>
                            <MenuItem value="100">100</MenuItem>
                            <MenuItem value="200">200</MenuItem>
                        </Select>
                    </FormControl>
                    <Button variant="outlined" disabled={loading || events.length === 0} onClick={onExport} startIcon={<Download />} sx={ghostActionButtonSx(accent)}>
                        Export CSV
                    </Button>
                    <Button variant="outlined" disabled={loading || !canGoBack} onClick={onPrevious} sx={ghostActionButtonSx(accent)}>
                        Prev
                    </Button>
                    <Button variant="outlined" disabled={loading || !canGoNext} onClick={onNext} sx={ghostActionButtonSx(accent)}>
                        Next
                    </Button>
                </Stack>
            </Stack>

            {events.length === 0 ? (
                <Stack spacing={1} sx={{ position: "relative", alignItems: "center", justifyContent: "center", py: 7, color: "rgba(255,255,255,0.54)" }}>
                    <ShieldOutlined sx={{ fontSize: 34, opacity: 0.72 }} />
                    <Typography variant="body2">{loading ? "Loading audit events..." : "No audit events match these filters."}</Typography>
                </Stack>
            ) : (
                <Stack spacing={1.4} sx={{ position: "relative" }}>
                    {events.map(event => (
                        <AuditEventCard key={event.id} event={event} />
                    ))}
                </Stack>
            )}
        </FeaturePanel>
    );
}
