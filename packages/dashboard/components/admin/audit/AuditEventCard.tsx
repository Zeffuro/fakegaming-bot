"use client";

import React from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import type { AuditEventEntry, AuditEventSeverity } from "@/lib/api/audit";

function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function severityColor(severity: AuditEventSeverity): string {
    if (severity === "error") return dashboardAccents.quotes;
    if (severity === "warn") return dashboardAccents.birthdays;
    return dashboardAccents.settings;
}

function compactMetadata(metadata: Record<string, unknown> | null): string {
    if (!metadata || Object.keys(metadata).length === 0) return "No metadata";
    return JSON.stringify(metadata, null, 2);
}

function targetLabel(event: AuditEventEntry): string {
    return event.targetId ? `${event.targetType}:${event.targetId}` : event.targetType;
}

export function AuditEventCard({ event }: { event: AuditEventEntry }) {
    const color = severityColor(event.severity);

    return (
        <Box sx={{ borderRadius: 3, p: 1.6, bgcolor: "rgba(255,255,255,0.045)", border: `1px solid ${alpha(color, 0.22)}` }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, mb: 1.3 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Chip size="small" label={event.severity} sx={{ bgcolor: alpha(color, 0.14), color: "grey.50", border: `1px solid ${alpha(color, 0.38)}`, textTransform: "uppercase", fontWeight: 800 }} />
                    <Chip size="small" label={event.status} sx={{ bgcolor: event.status === "success" ? alpha(dashboardAccents.settings, 0.12) : alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: "1px solid rgba(255,255,255,0.09)" }} />
                    <Typography variant="subtitle1" sx={{ color: "grey.50", fontWeight: 850 }}>
                        {event.action}
                    </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.54)", fontWeight: 700 }}>
                    {formatDateTime(event.timestamp)}
                </Typography>
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
                <AuditDetail label="Actor" value={event.actorId ? `${event.actorType}:${event.actorId}` : event.actorType} />
                <AuditDetail label="Target" value={targetLabel(event)} />
                <AuditDetail label="Guild" value={event.guildId ?? "None"} />
                <AuditDetail label="Request" value={event.requestId ?? "None"} />
            </Box>

            <Box
                component="pre"
                sx={{
                    mt: 1.2,
                    mb: 0,
                    p: 1.2,
                    borderRadius: 2.5,
                    bgcolor: "rgba(0,0,0,0.22)",
                    color: "rgba(255,255,255,0.70)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    fontSize: 12,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                }}
            >
                {compactMetadata(event.metadata)}
            </Box>
        </Box>
    );
}

function AuditDetail({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.42)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", fontWeight: 700, overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
    );
}
