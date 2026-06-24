"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { Alert, Box, Button, Checkbox, Chip, Divider, Stack, TextField, Typography } from "@mui/material";
import { api, type IntegrationHealthRecord, type TikTokLiveResponse } from "@/lib/api-client";

type TikTokDebugMeta = NonNullable<TikTokLiveResponse["debugMeta"]>;
type TikTokSessionDiagnostics = TikTokDebugMeta["session"];

export default function AdminTikTokDebugPage() {
    const [username, setUsername] = useState("");
    const [isLive, setIsLive] = useState<boolean | null>(null);
    const [details, setDetails] = useState<{ roomId: string | null; title: string | null; startedAt: number | null; viewers: number | null; cover: string | null } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
    const [debugMeta, setDebugMeta] = useState<TikTokDebugMeta | null>(null);
    const [healthRecords, setHealthRecords] = useState<IntegrationHealthRecord[]>([]);
    const [healthLoading, setHealthLoading] = useState(false);
    const [healthError, setHealthError] = useState<string | null>(null);

    const loadHealth = useCallback(async () => {
        setHealthLoading(true);
        try {
            const result = await api.getAdminIntegrationHealth({ provider: "tiktok", limit: 6 });
            setHealthRecords(result.records);
            setHealthError(null);
        } catch (err) {
            setHealthError(err instanceof Error ? err.message : "Failed to load TikTok health diagnostics");
        } finally {
            setHealthLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadHealth();
    }, [loadHealth]);

    const onCheck = async () => {
        setError(null);
        setIsLive(null);
        setDetails(null);
        setDebugMeta(null);
        const normalizedUsername = username.trim().replace(/^@/, "");
        if (!normalizedUsername) {
            setError("Please enter a TikTok username");
            return;
        }

        setLoading(true);
        try {
            const response = await api.getTikTokLive(normalizedUsername, includeDiagnostics);
            setIsLive(Boolean(response.live));
            setDetails({
                roomId: response.roomId ?? null,
                title: response.title ?? null,
                startedAt: response.startedAt ?? null,
                viewers: response.viewers ?? null,
                cover: response.cover ?? null,
            });
            setDebugMeta(response.debugMeta ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Request failed");
        } finally {
            setLoading(false);
        }
    };

    const normalizedUsername = username.trim().replace(/^@/, "");

    return (
        <AdminPage title="Admin - TikTok Live" trail={[{ label: "TikTok Live", href: "/dashboard/admin/tiktok" }]}>
            <Stack spacing={3} sx={{ maxWidth: 920 }}>
                <Box>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Check current live status and inspect sanitized connector diagnostics without exposing cookies or raw provider payloads.
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 1.5 }}>
                        <TextField
                            label="TikTok username"
                            placeholder="creator123"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            fullWidth
                        />
                        <Button variant="contained" onClick={() => void onCheck()} disabled={loading}>
                            {loading ? "Checking..." : "Check live"}
                        </Button>
                    </Stack>
                    <Box component="label" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
                        <Checkbox
                            checked={includeDiagnostics}
                            onChange={(event) => setIncludeDiagnostics(event.target.checked)}
                            size="small"
                        />
                        Include sanitized diagnostics
                    </Box>
                </Box>

                {error && <Alert severity="error">{error}</Alert>}

                {isLive !== null && (
                    <Alert severity={isLive ? "success" : "info"}>
                        {isLive ? "Live now" : "Not live"}
                    </Alert>
                )}

                {isLive && (
                    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                Live details
                            </Typography>
                            <Typography variant="body2">
                                Watch: <a href={`https://www.tiktok.com/@${normalizedUsername}/live`} target="_blank" rel="noreferrer">tiktok.com/@{normalizedUsername}/live</a>
                            </Typography>
                            <InfoRow label="Title" value={details?.title ?? "Unknown"} />
                            <InfoRow label="Viewers" value={typeof details?.viewers === "number" ? String(details.viewers) : "Unknown"} />
                            <InfoRow label="Room ID" value={details?.roomId ?? "Unknown"} />
                            <InfoRow label="Started" value={typeof details?.startedAt === "number" ? formatDateTime(details.startedAt) : "Unknown"} />
                            {details?.cover ? (
                                <Box sx={{ mt: 1 }}>
                                    <img src={details.cover} alt="TikTok live cover" style={{ maxWidth: "100%", borderRadius: 6 }} />
                                </Box>
                            ) : null}
                        </Stack>
                    </Box>
                )}

                {includeDiagnostics && debugMeta && <DiagnosticsPanel diagnostics={debugMeta} />}

                <Divider />

                <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 900 }}>
                                Recent poll diagnostics
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Last reported TikTok fetch state from integration health metadata.
                            </Typography>
                        </Box>
                        <Button variant="outlined" onClick={() => void loadHealth()} disabled={healthLoading}>
                            {healthLoading ? "Refreshing..." : "Refresh"}
                        </Button>
                    </Stack>

                    {healthError && <Alert severity="error">{healthError}</Alert>}

                    {healthRecords.length > 0 ? (
                        <Stack spacing={1.25}>
                            {healthRecords.map((record) => (
                                <HealthDiagnosticRow key={`${record.provider}:${record.configId}`} record={record} />
                            ))}
                        </Stack>
                    ) : (
                        <Alert severity="info">{healthLoading ? "Loading TikTok health diagnostics..." : "No TikTok health records found."}</Alert>
                    )}
                </Stack>
            </Stack>
        </AdminPage>
    );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: TikTokDebugMeta }) {
    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
            <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                        Sanitized diagnostics
                    </Typography>
                    <Chip size="small" label={diagnostics.fetchStatus} color={diagnostics.fetchStatus === "live" ? "success" : diagnostics.fetchStatus === "offline" ? "info" : "warning"} />
                    {diagnostics.errorCode && <Chip size="small" label={diagnostics.errorCode} variant="outlined" />}
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                    <InfoRow label="Method" value={diagnostics.method} />
                    <InfoRow label="Checked" value={formatDateTime(diagnostics.checkedAt)} />
                    <InfoRow label="Cached offline" value={diagnostics.cachedOffline ? "Yes" : "No"} />
                    <InfoRow label="Backoff until" value={diagnostics.offlineBackoffUntil ? formatDateTime(diagnostics.offlineBackoffUntil) : "None"} />
                </Box>
                <SessionDiagnostics session={diagnostics.session} />
            </Stack>
        </Box>
    );
}

function HealthDiagnosticRow({ record }: { record: IntegrationHealthRecord }) {
    const metadata = record.metadata ?? {};
    const fetchStatus = readString(metadata.lastFetchStatus) ?? "unknown";
    const fetchError = readString(metadata.lastFetchErrorCode);
    const cachedOffline = readBoolean(metadata.cachedOffline);
    const backoffUntil = readString(metadata.offlineBackoffUntil);
    const session = readSessionDiagnostics(metadata.tiktokSession);

    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
            <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 850 }}>{readString(metadata.username) ?? `Config ${record.configId}`}</Typography>
                    <Chip size="small" label={record.status} variant="outlined" />
                    <Chip size="small" label={fetchStatus} color={fetchStatus === "live" ? "success" : fetchStatus === "offline" ? "info" : "warning"} />
                    {fetchError && <Chip size="small" label={fetchError} variant="outlined" />}
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                    <InfoRow label="Guild" value={record.guildId ?? "Unknown"} />
                    <InfoRow label="Checked" value={formatDateTime(record.lastCheckedAt)} />
                    <InfoRow label="Cached offline" value={cachedOffline ? "Yes" : "No"} />
                    <InfoRow label="Backoff until" value={backoffUntil ? formatDateTime(backoffUntil) : "None"} />
                    <InfoRow label="Last delivery" value={formatDateTime(record.lastDeliveryAt)} />
                    <InfoRow label="Failures" value={String(record.consecutiveFailures)} />
                </Box>
                {session && <SessionDiagnostics session={session} compact />}
            </Stack>
        </Box>
    );
}

function SessionDiagnostics({ session, compact = false }: { session: TikTokSessionDiagnostics; compact?: boolean }) {
    return (
        <Box sx={{ borderRadius: 1.5, bgcolor: "action.hover", p: compact ? 1 : 1.25 }}>
            <Stack spacing={0.75}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    Session diagnostics
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                    <InfoRow label="Cookie configured" value={session.cookieConfigured ? "Yes" : "No"} />
                    <InfoRow label="Cookie pair count" value={String(session.cookiePairCount)} />
                    <InfoRow label="Likely session cookie" value={session.likelySessionCookiePresent ? "Yes" : "No"} />
                    <InfoRow label="Connector uses cookie" value={session.connectorUsesCookie ? "Yes" : "No"} />
                </Box>
                {!compact && (
                    <Typography variant="body2" color="text.secondary">
                        {session.summary}
                    </Typography>
                )}
            </Stack>
        </Box>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 800, textTransform: "uppercase" }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
    );
}

function readSessionDiagnostics(value: unknown): TikTokSessionDiagnostics | null {
    if (!isRecord(value)) return null;
    const cookieConfigured = readBoolean(value.cookieConfigured);
    const cookiePairCount = readNumber(value.cookiePairCount);
    const likelySessionCookiePresent = readBoolean(value.likelySessionCookiePresent);
    const connectorUsesCookie = readBoolean(value.connectorUsesCookie);
    const summary = readString(value.summary);
    if (cookieConfigured === null || cookiePairCount === null || likelySessionCookiePresent === null || connectorUsesCookie === null || !summary) return null;

    return {
        cookieConfigured,
        cookiePairCount,
        likelySessionCookiePresent,
        freshness: readString(value.freshness) === "unknown" ? "unknown" : "not-configured",
        connectorUsesCookie,
        summary,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

function readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDateTime(value?: string | number | null): string {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
}
