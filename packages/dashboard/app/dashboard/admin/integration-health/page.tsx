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
    CheckCircle,
    ErrorOutlined,
    HelpOutlined,
    MonitorHeart,
    PauseCircle,
    Refresh,
    WarningAmber,
} from "@mui/icons-material";
import { AdminPage } from "@/components/AdminPage";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { api, type AdminIntegrationHealthResponse, type IntegrationHealthRecord, type IntegrationHealthStatus } from "@/lib/api-client";

type StatusFilter = "" | IntegrationHealthStatus;

const PROVIDERS = ["twitch", "youtube", "tiktok", "bluesky", "patchnotes"] as const;

function formatDateTime(value?: string | null): string {
    if (!value) return "Never";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

function getStatusLabel(status: IntegrationHealthStatus, failures: number): string {
    if (status === "error") return `Failing x${Math.max(1, failures)}`;
    if (status === "healthy") return "Healthy";
    if (status === "warning") return "Warning";
    if (status === "paused") return "Paused";
    return "Unknown";
}

function getStatusAccent(status: IntegrationHealthStatus): string {
    if (status === "error") return dashboardAccents.quotes;
    if (status === "warning") return dashboardAccents.patchNotes;
    if (status === "healthy") return dashboardAccents.settings;
    if (status === "paused") return dashboardAccents.commands;
    return dashboardAccents.neutral;
}

function getStatusIcon(status: IntegrationHealthStatus): React.ReactNode {
    if (status === "error") return <ErrorOutlined />;
    if (status === "warning") return <WarningAmber />;
    if (status === "healthy") return <CheckCircle />;
    if (status === "paused") return <PauseCircle />;
    return <HelpOutlined />;
}

function HealthStat({
    label,
    value,
    accent,
}: {
    label: string;
    value: number;
    accent: string;
}) {
    return (
        <FeaturePanel accent={accent} sx={{ p: 2.25 }}>
            <Stack spacing={0.5} sx={{ position: "relative" }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {label}
                </Typography>
                <Typography variant="h4" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: "-0.05em" }}>
                    {value}
                </Typography>
            </Stack>
        </FeaturePanel>
    );
}

function HealthCard({ record }: { record: IntegrationHealthRecord }) {
    const accent = getStatusAccent(record.status);

    return (
        <FeaturePanel accent={accent} sx={{ p: 2.25 }}>
            <Stack spacing={1.5} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.1} sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                            {record.provider}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                            config {record.configId}
                        </Typography>
                    </Box>
                    <Chip
                        size="small"
                        icon={getStatusIcon(record.status) as React.ReactElement}
                        label={getStatusLabel(record.status, record.consecutiveFailures)}
                        sx={{
                            bgcolor: alpha(accent, 0.14),
                            color: "grey.50",
                            border: `1px solid ${alpha(accent, 0.38)}`,
                            "& .MuiChip-icon": { color: accent },
                        }}
                    />
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                    <InfoLine label="Guild" value={record.guildId ?? "Unknown"} />
                    <InfoLine label="Channel" value={record.channelId ?? "Unknown"} />
                    <InfoLine label="Checked" value={formatDateTime(record.lastCheckedAt)} />
                    <InfoLine label="Delivered" value={formatDateTime(record.lastDeliveryAt)} />
                </Box>

                {(record.lastErrorCode || record.lastErrorMessage) && (
                    <Box sx={{ borderRadius: 2.5, bgcolor: alpha(dashboardAccents.quotes, 0.10), border: `1px solid ${alpha(dashboardAccents.quotes, 0.22)}`, p: 1.25 }}>
                        {record.lastErrorCode && (
                            <Typography variant="caption" sx={{ display: "block", color: alpha("#fff", 0.58), fontWeight: 800, mb: 0.3 }}>
                                {record.lastErrorCode}
                            </Typography>
                        )}
                        {record.lastErrorMessage && (
                            <Typography variant="body2" sx={{ color: "grey.100", wordBreak: "break-word" }}>
                                {record.lastErrorMessage}
                            </Typography>
                        )}
                    </Box>
                )}
            </Stack>
        </FeaturePanel>
    );
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

export default function AdminIntegrationHealthPage() {
    const accent = dashboardAccents.admin;
    const [provider, setProvider] = useState("");
    const [guildId, setGuildId] = useState("");
    const [status, setStatus] = useState<StatusFilter>("error");
    const [offset, setOffset] = useState(0);
    const [data, setData] = useState<AdminIntegrationHealthResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const query = useMemo(() => ({
        provider: provider || undefined,
        guildId: guildId.trim() || undefined,
        status: status || undefined,
        limit: 50,
        offset,
    }), [guildId, offset, provider, status]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setData(await api.getAdminIntegrationHealth(query));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load integration health");
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        void load();
    }, [load]);

    const summary = data?.summary ?? { total: 0, healthy: 0, warning: 0, error: 0, paused: 0, unknown: 0 };
    const canGoBack = offset > 0;
    const canGoNext = data ? offset + data.limit < data.total : false;

    const clearFilters = () => {
        setProvider("");
        setGuildId("");
        setStatus("error");
        setOffset(0);
    };

    return (
        <AdminPage title="Integration Health" trail={[{ label: "Integration Health", href: "/dashboard/admin/integration-health" }]}>
            <Stack spacing={2.5}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(5, 1fr)" }, gap: 2 }}>
                    <HealthStat label="Total" value={summary.total} accent={dashboardAccents.neutral} />
                    <HealthStat label="Errors" value={summary.error} accent={dashboardAccents.quotes} />
                    <HealthStat label="Warnings" value={summary.warning} accent={dashboardAccents.patchNotes} />
                    <HealthStat label="Healthy" value={summary.healthy} accent={dashboardAccents.settings} />
                    <HealthStat label="Unknown" value={summary.unknown + summary.paused} accent={dashboardAccents.commands} />
                </Box>

                <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ position: "relative", alignItems: { xs: "stretch", md: "center" } }}>
                        <FormControl size="small" sx={{ ...dashboardFieldSx(accent), minWidth: 170 }}>
                            <InputLabel id="health-status-label">Status</InputLabel>
                            <Select
                                labelId="health-status-label"
                                label="Status"
                                value={status}
                                onChange={(event) => { setStatus(event.target.value as StatusFilter); setOffset(0); }}
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="error">Errors</MenuItem>
                                <MenuItem value="warning">Warnings</MenuItem>
                                <MenuItem value="healthy">Healthy</MenuItem>
                                <MenuItem value="paused">Paused</MenuItem>
                                <MenuItem value="unknown">Unknown</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ ...dashboardFieldSx(accent), minWidth: 170 }}>
                            <InputLabel id="health-provider-label">Provider</InputLabel>
                            <Select
                                labelId="health-provider-label"
                                label="Provider"
                                value={provider}
                                onChange={(event) => { setProvider(event.target.value); setOffset(0); }}
                            >
                                <MenuItem value="">All</MenuItem>
                                {PROVIDERS.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                            </Select>
                        </FormControl>

                        <TextField
                            label="Guild ID"
                            size="small"
                            value={guildId}
                            onChange={(event) => { setGuildId(event.target.value); setOffset(0); }}
                            sx={{ ...dashboardFieldSx(accent), minWidth: { md: 240 } }}
                        />

                        <Box sx={{ flex: 1 }} />

                        <Button variant="outlined" onClick={() => void load()} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
                            Refresh
                        </Button>
                        <Button variant="outlined" onClick={clearFilters} disabled={loading} sx={ghostActionButtonSx(accent)}>
                            Reset
                        </Button>
                    </Stack>
                </FeaturePanel>

                {error && (
                    <Alert severity="error" icon={<ErrorOutlined />} sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.22)}` }}>
                        {error}
                    </Alert>
                )}

                <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
                    <Stack spacing={2} sx={{ position: "relative" }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <MonitorHeart sx={{ color: accent }} />
                                <Box>
                                    <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900 }}>
                                        Matching integrations
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)" }}>
                                        {data ? `${data.total} result${data.total === 1 ? "" : "s"}` : "Loading..."}
                                    </Typography>
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1}>
                                <Button variant="outlined" disabled={!canGoBack || loading} onClick={() => setOffset(Math.max(0, offset - (data?.limit ?? 50)))} sx={ghostActionButtonSx(accent)}>
                                    Previous
                                </Button>
                                <Button variant="outlined" disabled={!canGoNext || loading} onClick={() => setOffset(offset + (data?.limit ?? 50))} sx={ghostActionButtonSx(accent)}>
                                    Next
                                </Button>
                            </Stack>
                        </Stack>

                        {data && data.records.length > 0 ? (
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                                {data.records.map(record => <HealthCard key={`${record.provider}:${record.configId}`} record={record} />)}
                            </Box>
                        ) : (
                            <Stack spacing={1} sx={{ minHeight: 140, alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.56)", textAlign: "center" }}>
                                <MonitorHeart sx={{ opacity: 0.65 }} />
                                <Typography variant="body2">{loading ? "Loading integration health..." : "No integrations match these filters."}</Typography>
                            </Stack>
                        )}
                    </Stack>
                </FeaturePanel>
            </Stack>
        </AdminPage>
    );
}
