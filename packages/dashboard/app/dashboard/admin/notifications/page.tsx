"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { getAdminProviderOptions, normalizeAdminProviderFilter } from "@/components/admin/providerOptions";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { api, type AdminNotificationRecord, type AdminNotificationsResponse } from "@/lib/api-client";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

function formatDateTime(
    value: string | null | undefined,
    formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string,
    unknown: string,
): string {
    if (!value) return unknown;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatDate(parsed, { dateStyle: "medium", timeStyle: "short" });
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.42)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {value}
            </Typography>
        </Box>
    );
}

function NotificationCard({ record }: { record: AdminNotificationRecord }) {
    const { t, formatDate } = useDashboardI18n();
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
                        label={record.messageId ? t("admin.notificationsMessageSaved") : t("admin.notificationsDedupeOnly")}
                        sx={{
                            bgcolor: alpha(accent, 0.14),
                            color: "grey.50",
                            border: `1px solid ${alpha(accent, 0.38)}`,
                            "& .MuiChip-icon": { color: accent },
                        }}
                    />
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                    <InfoLine label={t("admin.notificationsGuild")} value={record.guildId ?? t("common.unknown")} />
                    <InfoLine label={t("admin.notificationsChannel")} value={record.channelId ?? t("common.unknown")} />
                    <InfoLine label={t("admin.notificationsMessage")} value={record.messageId ?? t("admin.notificationsNotStored")} />
                    <InfoLine label={t("admin.notificationsRecorded")} value={formatDateTime(record.createdAt, formatDate, t("common.unknown"))} />
                </Box>
            </Stack>
        </FeaturePanel>
    );
}

function AdminNotificationsContent() {
    const { t, formatNumber } = useDashboardI18n();
    const accent = dashboardAccents.admin;
    const searchParams = useSearchParams();
    const searchParamString = searchParams?.toString() ?? "";
    const [provider, setProvider] = useState(() => normalizeAdminProviderFilter(searchParams?.get("provider")));
    const [guildId, setGuildId] = useState(() => searchParams?.get("guildId")?.trim() ?? "");
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
    const providerOptions = useMemo(() => getAdminProviderOptions(provider), [provider]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setData(await api.getAdminNotifications(query));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t("admin.notificationsLoadFailed"));
        } finally {
            setLoading(false);
        }
    }, [query, t]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const params = new URLSearchParams(searchParamString);
        setProvider(normalizeAdminProviderFilter(params.get("provider")));
        setGuildId(params.get("guildId")?.trim() ?? "");
        setOffset(0);
    }, [searchParamString]);

    const clearFilters = () => {
        setProvider("");
        setGuildId("");
        setOffset(0);
    };

    const summary = data?.summary ?? { total: 0, byProvider: [] };
    const canGoBack = offset > 0;
    const canGoNext = data ? offset + data.limit < data.total : false;

    return (
        <AdminPage title={t("admin.notificationsPageTitle")} trail={[{ label: t("admin.notifications"), href: "/dashboard/admin/notifications" }]}>
            <Stack spacing={2.5}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                    <FeaturePanel accent={dashboardAccents.commands} sx={{ p: 2.25 }}>
                        <Stack spacing={0.5} sx={{ position: "relative" }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)", fontWeight: 800, letterSpacing: 0, textTransform: "uppercase" }}>
                                {t("admin.notificationsTotal")}
                            </Typography>
                            <Typography variant="h4" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0 }}>
                                {formatNumber(summary.total)}
                            </Typography>
                        </Stack>
                    </FeaturePanel>
                    {summary.byProvider.slice(0, 3).map(item => (
                        <FeaturePanel key={item.provider} accent={dashboardAccents.commands} sx={{ p: 2.25 }}>
                            <Stack spacing={0.5} sx={{ position: "relative" }}>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)", fontWeight: 800, letterSpacing: 0, textTransform: "uppercase" }}>
                                    {item.provider}
                                </Typography>
                                <Typography variant="h4" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0 }}>
                                    {formatNumber(item.count)}
                                </Typography>
                            </Stack>
                        </FeaturePanel>
                    ))}
                </Box>

                <FeaturePanel accent={accent} sx={{ p: 2.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ position: "relative", alignItems: { xs: "stretch", md: "center" } }}>
                        <FormControl size="small" sx={{ ...dashboardFieldSx(accent), minWidth: 180 }}>
                            <InputLabel id="notification-provider-label">{t("admin.notificationsProvider")}</InputLabel>
                            <Select
                                labelId="notification-provider-label"
                                label={t("admin.notificationsProvider")}
                                value={provider}
                                onChange={(event) => { setProvider(event.target.value); setOffset(0); }}
                            >
                                <MenuItem value="">{t("admin.notificationsAll")}</MenuItem>
                                {providerOptions.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                            </Select>
                        </FormControl>

                        <TextField
                            label={t("admin.notificationsGuildId")}
                            size="small"
                            value={guildId}
                            onChange={(event) => { setGuildId(event.target.value); setOffset(0); }}
                            sx={{ ...dashboardFieldSx(accent), minWidth: { md: 260 } }}
                        />

                        <Box sx={{ flex: 1 }} />

                        <Button variant="outlined" onClick={() => void load()} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
                            {t("common.refresh")}
                        </Button>
                        <Button variant="outlined" onClick={clearFilters} disabled={loading} startIcon={<RestartAlt />} sx={ghostActionButtonSx(accent)}>
                            {t("admin.notificationsReset")}
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
                                <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0 }}>
                                    {t("admin.notificationsRecords")}
                                </Typography>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.5 }}>
                                    {t("admin.notificationsRecordsDescription")}
                                </Typography>
                            </Box>
                            <Chip
                                label={t("admin.notificationsMatching", { count: formatNumber(data?.total ?? 0) })}
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
                                    {loading ? t("admin.notificationsLoading") : t("admin.notificationsEmpty")}
                                </Typography>
                            </Box>
                        )}

                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
                            <Button variant="outlined" disabled={!canGoBack || loading} onClick={() => setOffset(current => Math.max(0, current - (data?.limit ?? 50)))} startIcon={<ArrowBack />} sx={ghostActionButtonSx(dashboardAccents.commands)}>
                                {t("admin.notificationsPrevious")}
                            </Button>
                            <Button variant="outlined" disabled={!canGoNext || loading} onClick={() => setOffset(current => current + (data?.limit ?? 50))} endIcon={<ArrowForward />} sx={ghostActionButtonSx(dashboardAccents.commands)}>
                                {t("admin.notificationsNext")}
                            </Button>
                        </Stack>
                    </Stack>
                </FeaturePanel>
            </Stack>
        </AdminPage>
    );
}

export default function AdminNotificationsPage() {
    const { t } = useDashboardI18n();

    return (
        <Suspense fallback={<AdminPage title={t("admin.notificationsPageTitle")}><Typography>{t("admin.notificationsLoadingDeliveries")}</Typography></AdminPage>}>
            <AdminNotificationsContent />
        </Suspense>
    );
}
