"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { Alert, Box, Button, Checkbox, Chip, Divider, Stack, TextField, Typography } from "@mui/material";
import { api, type IntegrationHealthRecord, type TikTokLiveResponse } from "@/lib/api-client";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

type TikTokDebugMeta = NonNullable<TikTokLiveResponse["debugMeta"]>;
type TikTokSessionDiagnostics = TikTokDebugMeta["session"];

export default function AdminTikTokDebugPage() {
    const { t, formatDate, formatNumber } = useDashboardI18n();
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
            setHealthError(err instanceof Error ? err.message : t("admin.tiktokHealthLoadFailed"));
        } finally {
            setHealthLoading(false);
        }
    }, [t]);

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
            setError(t("admin.tiktokUsernameRequired"));
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
            setError(err instanceof Error ? err.message : t("admin.tiktokRequestFailed"));
        } finally {
            setLoading(false);
        }
    };

    const normalizedUsername = username.trim().replace(/^@/, "");

    return (
        <AdminPage title={t("admin.tiktokPageTitle")} trail={[{ label: t("admin.tiktokDebug"), href: "/dashboard/admin/tiktok" }]}>
            <Stack spacing={3} sx={{ maxWidth: 920 }}>
                <Box>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        {t("admin.tiktokDescription")}
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 1.5 }}>
                        <TextField
                            label={t("admin.tiktokUsername")}
                            placeholder="creator123"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            fullWidth
                        />
                        <Button variant="contained" onClick={() => void onCheck()} disabled={loading}>
                            {loading ? t("admin.tiktokChecking") : t("admin.tiktokCheckLive")}
                        </Button>
                    </Stack>
                    <Box component="label" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
                        <Checkbox
                            checked={includeDiagnostics}
                            onChange={(event) => setIncludeDiagnostics(event.target.checked)}
                            size="small"
                        />
                        {t("admin.tiktokIncludeDiagnostics")}
                    </Box>
                </Box>

                {error && <Alert severity="error">{error}</Alert>}

                {isLive !== null && (
                    <Alert severity={isLive ? "success" : "info"}>
                        {isLive ? t("admin.tiktokLiveNow") : t("admin.tiktokNotLive")}
                    </Alert>
                )}

                {isLive && (
                    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                {t("admin.tiktokLiveDetails")}
                            </Typography>
                            <Typography variant="body2">
                                {t("admin.tiktokWatch")}: <a href={`https://www.tiktok.com/@${normalizedUsername}/live`} target="_blank" rel="noreferrer">tiktok.com/@{normalizedUsername}/live</a>
                            </Typography>
                            <InfoRow label={t("admin.tiktokTitle")} value={details?.title ?? t("common.unknown")} />
                            <InfoRow label={t("admin.tiktokViewers")} value={typeof details?.viewers === "number" ? formatNumber(details.viewers) : t("common.unknown")} />
                            <InfoRow label={t("admin.tiktokRoomId")} value={details?.roomId ?? t("common.unknown")} />
                            <InfoRow label={t("admin.tiktokStarted")} value={typeof details?.startedAt === "number" ? formatDateTime(details.startedAt, formatDate) : t("common.unknown")} />
                            {details?.cover ? (
                                <Box sx={{ mt: 1 }}>
                                    <img src={details.cover} alt={t("admin.tiktokCoverAlt")} style={{ maxWidth: "100%", borderRadius: 6 }} />
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
                                {t("admin.tiktokRecentDiagnostics")}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t("admin.tiktokRecentDiagnosticsDescription")}
                            </Typography>
                        </Box>
                        <Button variant="outlined" onClick={() => void loadHealth()} disabled={healthLoading}>
                            {healthLoading ? t("admin.tiktokRefreshing") : t("common.refresh")}
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
                        <Alert severity="info">{healthLoading ? t("admin.tiktokHealthLoading") : t("admin.tiktokNoHealthRecords")}</Alert>
                    )}
                </Stack>
            </Stack>
        </AdminPage>
    );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: TikTokDebugMeta }) {
    const { t, formatDate } = useDashboardI18n();

    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
            <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                        {t("admin.tiktokSanitizedDiagnostics")}
                    </Typography>
                    <Chip size="small" label={localizeFetchStatus(t, diagnostics.fetchStatus)} color={diagnostics.fetchStatus === "live" ? "success" : diagnostics.fetchStatus === "offline" ? "info" : "warning"} />
                    {diagnostics.errorCode && <Chip size="small" label={diagnostics.errorCode} variant="outlined" />}
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                    <InfoRow label={t("admin.tiktokMethod")} value={diagnostics.method} />
                    <InfoRow label={t("admin.tiktokChecked")} value={formatDateTime(diagnostics.checkedAt, formatDate)} />
                    <InfoRow label={t("admin.tiktokCachedOffline")} value={diagnostics.cachedOffline ? t("common.yes") : t("common.no")} />
                    <InfoRow label={t("admin.tiktokBackoffUntil")} value={diagnostics.offlineBackoffUntil ? formatDateTime(diagnostics.offlineBackoffUntil, formatDate) : t("common.none")} />
                </Box>
                <SessionDiagnostics session={diagnostics.session} />
            </Stack>
        </Box>
    );
}

function HealthDiagnosticRow({ record }: { record: IntegrationHealthRecord }) {
    const { t, formatDate, formatNumber } = useDashboardI18n();
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
                    <Typography sx={{ fontWeight: 850 }}>{readString(metadata.username) ?? t("admin.tiktokConfig", { id: record.configId })}</Typography>
                    <Chip size="small" label={localizeHealthStatus(t, record.status)} variant="outlined" />
                    <Chip size="small" label={localizeFetchStatus(t, fetchStatus)} color={fetchStatus === "live" ? "success" : fetchStatus === "offline" ? "info" : "warning"} />
                    {fetchError && <Chip size="small" label={fetchError} variant="outlined" />}
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                    <InfoRow label={t("admin.tiktokGuild")} value={record.guildId ?? t("common.unknown")} />
                    <InfoRow label={t("admin.tiktokChecked")} value={formatDateTime(record.lastCheckedAt, formatDate, t("common.never"))} />
                    <InfoRow label={t("admin.tiktokCachedOffline")} value={cachedOffline ? t("common.yes") : t("common.no")} />
                    <InfoRow label={t("admin.tiktokBackoffUntil")} value={backoffUntil ? formatDateTime(backoffUntil, formatDate) : t("common.none")} />
                    <InfoRow label={t("admin.tiktokLastDelivery")} value={formatDateTime(record.lastDeliveryAt, formatDate, t("common.never"))} />
                    <InfoRow label={t("admin.tiktokFailures")} value={formatNumber(record.consecutiveFailures)} />
                </Box>
                {session && <SessionDiagnostics session={session} compact />}
            </Stack>
        </Box>
    );
}

function SessionDiagnostics({ session, compact = false }: { session: TikTokSessionDiagnostics; compact?: boolean }) {
    const { t, formatNumber } = useDashboardI18n();
    const summary = session.cookieConfigured
        ? session.likelySessionCookiePresent
            ? t("admin.tiktokSessionAttached")
            : t("admin.tiktokSessionUnrecognized")
        : t("admin.tiktokSessionMissing");

    return (
        <Box sx={{ borderRadius: 1.5, bgcolor: "action.hover", p: compact ? 1 : 1.25 }}>
            <Stack spacing={0.75}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {t("admin.tiktokSessionDiagnostics")}
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                    <InfoRow label={t("admin.tiktokCookieConfigured")} value={session.cookieConfigured ? t("common.yes") : t("common.no")} />
                    <InfoRow label={t("admin.tiktokCookiePairCount")} value={formatNumber(session.cookiePairCount)} />
                    <InfoRow label={t("admin.tiktokLikelySessionCookie")} value={session.likelySessionCookiePresent ? t("common.yes") : t("common.no")} />
                    <InfoRow label={t("admin.tiktokConnectorUsesCookie")} value={session.connectorUsesCookie ? t("common.yes") : t("common.no")} />
                </Box>
                {!compact && (
                    <Typography variant="body2" color="text.secondary">
                        {summary}
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

function localizeFetchStatus(
    t: ReturnType<typeof useDashboardI18n>["t"],
    status: string,
): string {
    switch (status) {
        case "live": return t("admin.tiktokStatusLive");
        case "offline": return t("admin.tiktokStatusOffline");
        case "connect-failed": return t("admin.tiktokStatusConnectFailed");
        case "unknown": return t("admin.tiktokStatusUnknown");
        default: return status;
    }
}

function localizeHealthStatus(
    t: ReturnType<typeof useDashboardI18n>["t"],
    status: IntegrationHealthRecord["status"],
): string {
    switch (status) {
        case "healthy": return t("admin.tiktokHealthHealthy");
        case "warning": return t("admin.tiktokHealthWarning");
        case "error": return t("admin.tiktokHealthError");
        case "paused": return t("admin.tiktokHealthPaused");
        case "unknown": return t("admin.tiktokStatusUnknown");
    }
}

function formatDateTime(
    value: string | number | null | undefined,
    formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string,
    emptyValue = "",
): string {
    if (!value) return emptyValue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return formatDate(date, { dateStyle: "medium", timeStyle: "short" });
}
