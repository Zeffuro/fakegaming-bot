"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    ArrowBack,
    ArrowForward,
    ErrorOutlined,
    NotificationsActive,
    Refresh,
    RestartAlt,
} from "@mui/icons-material";
import { AdminPage } from "@/components/AdminPage";
import { ADMIN_PROVIDER_OPTIONS } from "@/components/admin/providerOptions";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { api, type AdminNotificationRecord, type AdminNotificationsResponse } from "@/lib/api-client";

function formatDateTime(value?: string | null): string {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.42)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {value}
            </Typography>
        </Box>
    );
}

function NotificationCard({ record }: { record: AdminNotificationRecord }) {
    const accent = dashboardAccents.commands;

    return (
        <FeaturePanel accent={accent} sx={{ p: 2.25 }}>
            <Stack spacing={1.5} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.1} sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                            {record.provider}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", wordBreak: "break-all" }}>
                            {record.eventId}
                        </Typography>
                    </Box>
                    <Chip
                        size="small"
                        icon={<NotificationsActive />}
                        label={record.messageId ? "message saved" : "dedupe only"}
                        sx={{
                            bgcolor: alpha(accent, 0.14),
                            color: "grey.50",
                            border: `1px solid ${alpha(accent, 0.38)}`,
                            "& .MuiChip-icon": { color: accent },
                        }}
                    />
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                    <InfoLine label="Guild" value={record.guildId ?? "Unknown"} />
                    <InfoLine label="Channel" value={record.channelId ?? "Unknown"} />
                    <InfoLine label="Message" value={record.messageId ?? "Not stored"} />
                    <InfoLine label="Recorded" value={formatDateTime(record.createdAt)} />
                </Box>
            </Stack>
        </FeaturePanel>
    );
}

export default function AdminNotificationsPage() {
    const accent = dashboardAccents.admin;
    const [provider, setProvider] = useState("");
    const [guildId, setGuildId] = useState("");
    const [offset, setOffset] = useState(0);
    const [data, setData] = useState<AdminNotificationsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const query = useMemo(() => ({
        provider: provider || undefined,
        guildId: guildId.trim() || undefined,
        limit: 50,
        offset,
    }), [guildId, offset, provider]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setData(await api.getAdminNotifications(query));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load notification deliveries");
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        void load();
    }, [load]);

    const clearFilters = () => {
        setProvider("");
        setGuildId("");
        setOffset(0);
    };

    const summary = data?.summary ?? { total: 0, byProvider: [] };
    const canGoBack = offset > 0;
    const canGoNext = data ? offset + data.limit < data.total : false;

    return (
        <AdminPage title="Notification Deliveries" trail={[{ label: "Notifications", href: "/dashboard/admin/notifications" }]}>
            <Stack spacing={2.5}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                    <FeaturePanel accent={dashboardAccents.commands} sx={{ p: 2.25 }}>
                        <Stack spacing={0.5} sx={{ position: "relative" }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Total
                            </Typography>
                            <Typography variant="h4" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: "-0.05em" }}>
                                {summary.total}
                            </Typography>
                        </Stack>
                    </FeaturePanel>
                    {summary.byProvider.slice(0, 3).map(item => (
                        <FeaturePanel key={item.provider} accent={dashboardAccents.commands} sx={{ p: 2.25 }}>
                            <Stack spacing={0.5} sx={{ position: "relative" }}>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                    {item.provider}
                                </Typography>
                                <Typography variant="h4" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: "-0.05em" }}>
                                    {item.count}
                                </Typography>
                            </Stack>
                        </FeaturePanel>
                    ))}
                </Box>

                <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ position: "relative", alignItems: { xs: "stretch", md: "center" } }}>
                        <FormControl size="small" sx={{ ...dashboardFieldSx(accent), minWidth: 180 }}>
                            <InputLabel id="notification-provider-label">Provider</InputLabel>
                            <Select
                                labelId="notification-provider-label"
                                label="Provider"
                                value={provider}
                                onChange={(event) => { setProvider(event.target.value); setOffset(0); }}
                            >
                                <MenuItem value="">All</MenuItem>
                                {ADMIN_PROVIDER_OPTIONS.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                            </Select>
                        </FormControl>

                        <TextField
                            label="Guild ID"
                            size="small"
                            value={guildId}
                            onChange={(event) => { setGuildId(event.target.value); setOffset(0); }}
                            sx={{ ...dashboardFieldSx(accent), minWidth: { md: 260 } }}
                        />

                        <Box sx={{ flex: 1 }} />

                        <Button variant="outlined" onClick={() => void load()} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
                            Refresh
                        </Button>
                        <Button variant="outlined" onClick={clearFilters} disabled={loading} startIcon={<RestartAlt />} sx={ghostActionButtonSx(accent)}>
                            Reset
                        </Button>
                    </Stack>
                </FeaturePanel>

                {error && (
                    <Alert severity="error" icon={<ErrorOutlined />} sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.22)}` }}>
                        {error}
                    </Alert>
                )}

                <FeaturePanel accent={dashboardAccents.commands} sx={{ p: 2.5 }}>
                    <Stack spacing={2} sx={{ position: "relative" }}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between" }}>
                            <Box>
                                <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: "-0.04em" }}>
                                    Delivery records
                                </Typography>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.5 }}>
                                    These are dedupe and delivery metadata records, not logged message content.
                                </Typography>
                            </Box>
                            <Chip
                                label={`${data?.total ?? 0} matching`}
                                sx={{ bgcolor: alpha(dashboardAccents.commands, 0.14), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.commands, 0.28)}` }}
                            />
                        </Stack>

                        {data?.records.length ? (
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                                {data.records.map(record => (
                                    <NotificationCard key={record.id} record={record} />
                                ))}
                            </Box>
                        ) : (
                            <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.035)", border: "1px dashed rgba(255,255,255,0.12)", p: 2 }}>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
                                    {loading ? "Loading notification records..." : "No notification records match the current filters."}
                                </Typography>
                            </Box>
                        )}

                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
                            <Button variant="outlined" disabled={!canGoBack || loading} onClick={() => setOffset(current => Math.max(0, current - (data?.limit ?? 50)))} startIcon={<ArrowBack />} sx={ghostActionButtonSx(dashboardAccents.commands)}>
                                Previous
                            </Button>
                            <Button variant="outlined" disabled={!canGoNext || loading} onClick={() => setOffset(current => current + (data?.limit ?? 50))} endIcon={<ArrowForward />} sx={ghostActionButtonSx(dashboardAccents.commands)}>
                                Next
                            </Button>
                        </Stack>
                    </Stack>
                </FeaturePanel>
            </Stack>
        </AdminPage>
    );
}
