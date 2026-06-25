"use client";

import React from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { BarChart } from "@mui/icons-material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import type { RiotLeagueFormAuditSummary as RiotLeagueFormAuditSummaryModel } from "@/lib/adminRiotLeagueFormAudit";

interface RiotLeagueFormAuditSummaryProps {
    summary: RiotLeagueFormAuditSummaryModel | null;
}

export function RiotLeagueFormAuditSummary({ summary }: RiotLeagueFormAuditSummaryProps) {
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
                                Riot League form audit
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
                                {summary.total} loaded {summary.total === 1 ? "event" : "events"}
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                        <SummaryChip label={`${summary.successes} success`} accent={dashboardAccents.settings} />
                        <SummaryChip label={`${summary.failures} failed`} accent={dashboardAccents.quotes} />
                        <SummaryChip label={`${summary.warnings} warn`} accent={dashboardAccents.birthdays} />
                    </Stack>
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
                    <SummaryMetric label="Cache hits" value={summary.cacheHits} />
                    <SummaryMetric label="Cache misses" value={summary.cacheMisses} />
                    <SummaryMetric label="Cache bypasses" value={summary.cacheBypasses} />
                    <SummaryMetric label="Live attempts" value={summary.liveAttempts} />
                    <SummaryMetric label="Refresh requests" value={summary.refreshRequests} />
                    <SummaryMetric label="Partial" value={summary.partials} />
                    <SummaryMetric label="Empty" value={summary.emptyHistory} />
                    <SummaryMetric label="Detail failures" value={summary.detailFailures} />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                    <CountStrip label="Outcomes" rows={summary.outcomes} emptyLabel="No outcome metadata" />
                    <CountStrip label="Error categories" rows={summary.errorCategories} emptyLabel="No error categories" />
                </Box>
            </Stack>
        </FeaturePanel>
    );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
    return (
        <Box sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", p: 1.2, minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.44)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {label}
            </Typography>
            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.2 }}>
                {value}
            </Typography>
        </Box>
    );
}

function CountStrip({ label, rows, emptyLabel }: { label: string; rows: { label: string; count: number }[]; emptyLabel: string }) {
    return (
        <Box sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", p: 1.2, minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.44)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.8 }}>
                {label}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                {rows.length > 0 ? rows.map(row => (
                    <SummaryChip key={row.label} label={`${row.label}: ${row.count}`} accent={dashboardAccents.admin} />
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
