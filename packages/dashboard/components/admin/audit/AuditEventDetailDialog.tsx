"use client";

import React from "react";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Close, DataObject } from "@mui/icons-material";
import { dashboardAccents, dashboardDialogPaperSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { buildAdminAuditMetadataView } from "@/lib/adminAuditDetail";
import type { AuditEventEntry } from "@/lib/api/audit";

interface AuditEventDetailDialogProps {
    event: AuditEventEntry | null;
    open: boolean;
    onClose: () => void;
}

export function AuditEventDetailDialog({ event, open, onClose }: AuditEventDetailDialogProps) {
    const metadata = buildAdminAuditMetadataView(event?.metadata ?? null);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            slotProps={{ paper: { sx: dashboardDialogPaperSx(dashboardAccents.admin) } }}
        >
            <DialogTitle sx={{ color: "grey.100", fontWeight: 900 }}>
                Audit Event Detail
            </DialogTitle>
            <DialogContent>
                {event ? (
                    <Stack spacing={2.2} sx={{ pt: 0.5 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                            <Chip size="small" label={`#${event.id}`} sx={detailChipSx(dashboardAccents.admin)} />
                            <Chip size="small" label={event.status} sx={detailChipSx(event.status === "failure" ? dashboardAccents.quotes : dashboardAccents.settings)} />
                            <Chip size="small" label={event.severity} sx={detailChipSx(getSeverityAccent(event.severity))} />
                        </Stack>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                            <DetailLine label="Action" value={event.action} />
                            <DetailLine label="Timestamp" value={formatDateTime(event.timestamp)} />
                            <DetailLine label="Actor" value={event.actorId ? `${event.actorType}:${event.actorId}` : event.actorType} />
                            <DetailLine label="Target" value={event.targetId ? `${event.targetType}:${event.targetId}` : event.targetType} />
                            <DetailLine label="Guild" value={event.guildId ?? "None"} />
                            <DetailLine label="Request" value={event.requestId ?? "None"} />
                        </Box>

                        <Box sx={{ borderRadius: 2.5, bgcolor: alpha(dashboardAccents.admin, 0.09), border: `1px solid ${alpha(dashboardAccents.admin, 0.22)}`, p: 1.4 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
                                <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                                    <DataObject sx={{ color: dashboardAccents.admin, fontSize: 20 }} />
                                    <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 850 }}>
                                        Metadata
                                    </Typography>
                                </Stack>
                                <Chip size="small" label={metadata.hasMetadata ? `${metadata.keyCount} keys` : "Empty"} sx={detailChipSx(metadata.hasMetadata ? dashboardAccents.admin : dashboardAccents.neutral)} />
                            </Stack>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.54)", display: "block", mb: 1 }}>
                                {metadata.summary}
                            </Typography>
                            <Box
                                component="pre"
                                sx={{
                                    m: 0,
                                    p: 1.25,
                                    borderRadius: 2,
                                    bgcolor: "rgba(0,0,0,0.24)",
                                    color: "rgba(255,255,255,0.74)",
                                    border: "1px solid rgba(255,255,255,0.07)",
                                    fontSize: 12,
                                    maxHeight: 360,
                                    overflow: "auto",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                }}
                            >
                                {metadata.formatted}
                            </Box>
                        </Box>
                    </Stack>
                ) : null}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button variant="outlined" onClick={onClose} startIcon={<Close />} sx={ghostActionButtonSx(dashboardAccents.admin)}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function DetailLine({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ minWidth: 0, borderRadius: 2, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", p: 1.2 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.44)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", fontWeight: 750, overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
    );
}

function detailChipSx(accent: string) {
    return {
        bgcolor: alpha(accent, 0.14),
        color: "grey.50",
        border: `1px solid ${alpha(accent, 0.34)}`,
        textTransform: "uppercase",
        fontWeight: 800,
    };
}

function getSeverityAccent(severity: AuditEventEntry["severity"]): string {
    if (severity === "error") return dashboardAccents.quotes;
    if (severity === "warn") return dashboardAccents.birthdays;
    return dashboardAccents.settings;
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}
