"use client";

import React, { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Box, Button, Chip, Divider, LinearProgress, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    BarChart,
    CheckCircle,
    Download,
    ErrorOutlined,
    NotificationsActive,
    PauseCircle,
    Timeline,
    WarningAmber,
} from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { useAnimeConfigs } from "@/components/hooks/useAnime";
import { useBirthdays } from "@/components/hooks/useBirthdays";
import { useBlueskyConfigs } from "@/components/hooks/useBluesky";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useGuildNotificationHistory } from "@/components/hooks/useGuildNotificationHistory";
import { useIntegrationHealth } from "@/components/hooks/useIntegrationHealth";
import { usePatchSubscriptions } from "@/components/hooks/usePatchSubscriptions";
import { useSteamNewsConfigs } from "@/components/hooks/useSteamNews";
import { useTikTokConfigs } from "@/components/hooks/useTikTok";
import { useTwitchConfigs } from "@/components/hooks/useTwitch";
import { useYouTubeConfigs } from "@/components/hooks/useYouTube";
import {
    buildGuildNotificationAnalytics,
    buildGuildNotificationAnalyticsCsvRows,
    guildAnalyticsWindowDaysOptions,
    guildNotificationAnalyticsCsvHeaders,
    isGuildAnalyticsWindowDays,
    parseGuildAnalyticsWindowDays,
    serializeGuildAnalyticsWindowDays,
    type GuildAnalyticsConfigRecord,
    type GuildAnalyticsHealthStatus,
    type GuildAnalyticsProvider,
    type GuildAnalyticsTrendPoint,
    type GuildAnalyticsWindowDays,
} from "@/lib/guildNotificationAnalytics";
import { createCsvFilename, downloadCsv } from "@/lib/csvExport";
import type { IntegrationHealthRecord, NotificationDeliveryRecord } from "@/lib/api-client";

interface AnalyticsSourceConfig {
    id?: string | number | null;
    userId?: string | null;
    paused?: boolean | null;
}

const providerRoutes = new Map<string, string>([
    ["twitch", "twitch"],
    ["youtube", "youtube"],
    ["steamnews", "steam-news"],
    ["tiktok", "tiktok"],
    ["bluesky", "bluesky"],
    ["patchnotes", "patch-notes"],
    ["anime", "anime"],
    ["birthday", "birthdays"],
]);

function GuildAnalyticsContent() {
    const { t, formatDate, formatNumber, formatRelativeTime } = useDashboardI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchParamString = searchParams?.toString() ?? "";
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const [selectedProviderKey, setSelectedProviderKey] = useState<string | null>(null);
    const resolvedGuildId = guildId as string;
    const encodedGuildId = encodeURIComponent(resolvedGuildId);
    const analyticsWindowDays = useMemo(() => (
        parseGuildAnalyticsWindowDays(new URLSearchParams(searchParamString))
    ), [searchParamString]);
    const updateAnalyticsWindowDays = useCallback((days: GuildAnalyticsWindowDays) => {
        const query = serializeGuildAnalyticsWindowDays(new URLSearchParams(searchParamString), days);
        const path = `/dashboard/analytics/${encodedGuildId}`;
        router.replace(query ? `${path}?${query}` : path, { scroll: false });
    }, [encodedGuildId, router, searchParamString]);
    const guildReady = Boolean(guild);
    const twitchApi = useTwitchConfigs(resolvedGuildId, { enabled: guildReady });
    const youtubeApi = useYouTubeConfigs(resolvedGuildId, { enabled: guildReady });
    const steamNewsApi = useSteamNewsConfigs(resolvedGuildId, { enabled: guildReady });
    const patchApi = usePatchSubscriptions(resolvedGuildId, { enabled: guildReady });
    const tiktokApi = useTikTokConfigs(resolvedGuildId, { enabled: guildReady });
    const blueskyApi = useBlueskyConfigs(resolvedGuildId, { enabled: guildReady });
    const animeApi = useAnimeConfigs(resolvedGuildId, { enabled: guildReady });
    const birthdayApi = useBirthdays(resolvedGuildId, { enabled: guildReady });
    const healthApi = useIntegrationHealth(resolvedGuildId, undefined, { enabled: guildReady });
    const historyApi = useGuildNotificationHistory(resolvedGuildId, { enabled: guildReady, limit: 100, days: analyticsWindowDays });
    const providerHistoryApi = useGuildNotificationHistory(resolvedGuildId, {
        enabled: guildReady && selectedProviderKey !== null,
        limit: 20,
        days: analyticsWindowDays,
        provider: selectedProviderKey,
    });

    const configs = useMemo<GuildAnalyticsConfigRecord[]>(() => [
        ...toAnalyticsConfigRecords("twitch", "Twitch", twitchApi.configs),
        ...toAnalyticsConfigRecords("youtube", "YouTube", youtubeApi.configs),
        ...toAnalyticsConfigRecords("steamnews", "Steam News", steamNewsApi.configs),
        ...toAnalyticsConfigRecords("tiktok", "TikTok", tiktokApi.configs),
        ...toAnalyticsConfigRecords("bluesky", "Bluesky", blueskyApi.configs),
        ...toAnalyticsConfigRecords("patchnotes", "Patch Notes", patchApi.configs),
        ...toAnalyticsConfigRecords("anime", "Anime", animeApi.configs),
        ...toAnalyticsConfigRecords("birthday", "Birthdays", birthdayApi.birthdays, "userId"),
    ], [
        twitchApi.configs,
        youtubeApi.configs,
        steamNewsApi.configs,
        tiktokApi.configs,
        blueskyApi.configs,
        patchApi.configs,
        animeApi.configs,
        birthdayApi.birthdays,
    ]);
    const analytics = useMemo(() => buildGuildNotificationAnalytics({
        configs,
        healthRecords: healthApi.records,
        notificationRecords: historyApi.history?.records ?? [],
        notificationProviders: historyApi.history?.summary.byProvider ?? [],
        notificationTrend: historyApi.history?.summary.trend ?? [],
    }), [configs, healthApi.records, historyApi.history]);
    const exportAnalytics = useCallback(() => {
        downloadCsv(
            createCsvFilename(`guild-${resolvedGuildId}-notification-analytics-${analyticsWindowDays}d`),
            guildNotificationAnalyticsCsvHeaders,
            buildGuildNotificationAnalyticsCsvRows(analytics, analyticsWindowDays),
        );
    }, [analytics, analyticsWindowDays, resolvedGuildId]);
    const selectedProvider = useMemo(() => {
        if (!selectedProviderKey) return null;
        return analytics.providers.find((provider) => provider.providerKey === selectedProviderKey) ?? null;
    }, [analytics.providers, selectedProviderKey]);
    const selectedProviderTrend = useMemo<GuildAnalyticsTrendPoint[]>(() => (
        providerHistoryApi.history?.summary.trend ?? []
    ).map((point) => ({
        date: point.date,
        deliveries: Math.max(0, Math.floor(point.count)),
    })), [providerHistoryApi.history]);
    const selectedProviderHealthRecords = useMemo(() => {
        if (!selectedProviderKey) return [];
        return healthApi.records.filter((record) => normalizeProviderKey(record.provider) === selectedProviderKey);
    }, [healthApi.records, selectedProviderKey]);
    const loading = guildsLoading
        || twitchApi.loading
        || youtubeApi.loading
        || steamNewsApi.loading
        || patchApi.loading
        || tiktokApi.loading
        || blueskyApi.loading
        || animeApi.loading
        || birthdayApi.loading
        || healthApi.loading
        || historyApi.loading;
    const errors = [
        twitchApi.error,
        youtubeApi.error,
        steamNewsApi.error,
        patchApi.error,
        tiktokApi.error,
        blueskyApi.error,
        animeApi.error,
        birthdayApi.error,
        healthApi.error,
        historyApi.error,
    ].filter((error): error is string => Boolean(error));

    if (!guild && !guildsLoading) {
        return <GuildAccessError />;
    }

    const trail = guild ? [
        { label: t("nav.dashboard"), href: `/dashboard/${encodedGuildId}` },
        { label: t("analytics.title"), href: null },
    ] : null;

    return (
        <DashboardLayout guild={guild} currentModule="analytics" currentTrail={trail} maxWidth="xl" loading={guildsLoading}>
            {guild && (
                <FeatureShell accent={dashboardAccents.commands} secondaryAccent={dashboardAccents.settings}>
                    <FeatureHero
                        icon={<Timeline />}
                        eyebrow={t("analytics.title")}
                        title={t("analytics.title")}
                        description={t("analytics.description")}
                        accent={dashboardAccents.commands}
                        secondaryAccent={dashboardAccents.settings}
                        stats={[
                            { label: t("analytics.configuredFeeds"), value: loading ? "..." : formatNumber(analytics.totalConfigured) },
                            { label: t("analytics.deliveriesRecorded"), value: historyApi.loading ? "..." : formatNumber(analytics.totalDeliveries) },
                            { label: t("analytics.healthIssues"), value: loading ? "..." : formatNumber(analytics.healthErrors + analytics.healthWarnings) },
                        ]}
                        actions={(
                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                                <Button
                                    component={Link}
                                    href={`/dashboard/settings/${encodedGuildId}/notifications`}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(dashboardAccents.commands)}
                                >
                                    {t("analytics.openNotifications")}
                                </Button>
                                <Button
                                    disabled={loading}
                                    onClick={exportAnalytics}
                                    startIcon={<Download />}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    {t("analytics.exportCsv")}
                                </Button>
                            </Stack>
                        )}
                    />

                    {loading && <LinearProgress sx={{ mb: 2.5, borderRadius: 999, bgcolor: "rgba(255,255,255,0.08)" }} />}
                    {errors.length > 0 && (
                        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2.5, bgcolor: alpha(dashboardAccents.patchNotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.patchNotes, 0.25)}` }}>
                            {t("analytics.partialData", { errors: errors.join(" / ") })}
                        </Alert>
                    )}

                    <AnalyticsWindowSelector value={analyticsWindowDays} onChange={updateAnalyticsWindowDays} />

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2, mb: 2.5 }}>
                        <MetricPanel label={t("analytics.activeFeeds")} value={formatNumber(analytics.activeConfigs)} accent={dashboardAccents.settings} icon={<CheckCircle />} />
                        <MetricPanel label={t("analytics.pausedFeeds")} value={formatNumber(analytics.pausedConfigs)} accent={dashboardAccents.commands} icon={<PauseCircle />} />
                        <MetricPanel label={t("analytics.healthErrors")} value={formatNumber(analytics.healthErrors)} accent={dashboardAccents.quotes} icon={<ErrorOutlined />} />
                        <MetricPanel label={t("analytics.lastDelivery")} value={formatRelativeTimestamp(analytics.lastDeliveryAt, formatDate, formatRelativeTime, t)} accent={dashboardAccents.youtube} icon={<NotificationsActive />} />
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 0.95fr) minmax(0, 1.35fr)" }, gap: 2.5 }}>
                        <DeliveryTrendPanel trend={analytics.trend} days={analyticsWindowDays} />
                        <ProviderAnalyticsPanel
                            guildId={resolvedGuildId}
                            providers={analytics.providers}
                            selectedProviderKey={selectedProviderKey}
                            onSelectProvider={setSelectedProviderKey}
                        />
                    </Box>
                    {selectedProvider && (
                        <ProviderDrilldownPanel
                            guildId={resolvedGuildId}
                            provider={selectedProvider}
                            trend={selectedProviderTrend}
                            records={providerHistoryApi.history?.records ?? []}
                            healthRecords={selectedProviderHealthRecords}
                            loading={providerHistoryApi.loading}
                            error={providerHistoryApi.error}
                            onClear={() => setSelectedProviderKey(null)}
                        />
                    )}
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}

export default function GuildAnalyticsPage() {
    return (
        <Suspense fallback={<DashboardLayout maxWidth="xl" loading><span /></DashboardLayout>}>
            <GuildAnalyticsContent />
        </Suspense>
    );
}

function MetricPanel({
    label,
    value,
    accent,
    icon,
}: {
    label: string;
    value: string | number;
    accent: string;
    icon: React.ReactNode;
}) {
    return (
        <FeaturePanel accent={accent} sx={{ p: 2.25 }}>
            <Stack direction="row" spacing={1.4} sx={{ position: "relative", alignItems: "center" }}>
                <Box sx={{ color: accent, display: "grid", placeItems: "center" }}>
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)", fontWeight: 850, letterSpacing: 0, textTransform: "uppercase" }}>
                        {label}
                    </Typography>
                    <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0, lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {value}
                    </Typography>
                </Box>
            </Stack>
        </FeaturePanel>
    );
}

function AnalyticsWindowSelector({
    value,
    onChange,
}: {
    value: GuildAnalyticsWindowDays;
    onChange: (days: GuildAnalyticsWindowDays) => void;
}) {
    const { t, formatNumber } = useDashboardI18n();
    const handleChange = (_event: React.MouseEvent<HTMLElement>, nextValue: unknown): void => {
        if (typeof nextValue !== "number" || !isGuildAnalyticsWindowDays(nextValue)) return;
        onChange(nextValue);
    };

    return (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)", fontWeight: 850, letterSpacing: 0, textTransform: "uppercase" }}>
                {t("analytics.window")}
            </Typography>
            <ToggleButtonGroup
                exclusive
                size="small"
                value={value}
                onChange={handleChange}
                aria-label={t("analytics.windowAria")}
                sx={{
                    alignSelf: { xs: "flex-start", sm: "center" },
                    bgcolor: "rgba(255,255,255,0.045)",
                    borderRadius: 999,
                    p: 0.35,
                    "& .MuiToggleButton-root": {
                        minWidth: 58,
                        border: 0,
                        borderRadius: 999,
                        color: "rgba(255,255,255,0.68)",
                        fontWeight: 850,
                        textTransform: "none",
                        px: 1.5,
                        "&.Mui-selected": {
                            bgcolor: alpha(dashboardAccents.commands, 0.22),
                            color: "grey.50",
                        },
                        "&.Mui-selected:hover": {
                            bgcolor: alpha(dashboardAccents.commands, 0.28),
                        },
                    },
                }}
            >
                {guildAnalyticsWindowDaysOptions.map((days) => (
                    <ToggleButton key={days} value={days} aria-label={t("analytics.windowOptionAria", { days: formatNumber(days) })}>
                        {t("analytics.days", { days: formatNumber(days) })}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>
        </Stack>
    );
}

function DeliveryTrendPanel({ trend, days }: { trend: GuildAnalyticsTrendPoint[]; days: number }) {
    const { t, formatNumber } = useDashboardI18n();
    const totalDeliveries = trend.reduce((total, point) => total + point.deliveries, 0);

    return (
        <FeaturePanel accent={dashboardAccents.commands} sx={{ p: 2.5, minHeight: 360 }}>
            <Stack spacing={2} sx={{ position: "relative", height: "100%" }}>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                    <BarChart sx={{ color: dashboardAccents.commands }} />
                    <Box>
                        <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                            {t("analytics.deliveryTrend")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                            {t("analytics.trendDescription", { days: formatNumber(trend.length || days) })}
                        </Typography>
                    </Box>
                </Stack>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                {trend.length > 0 ? (
                    <TrendBarStrip trend={trend} accent={dashboardAccents.commands} totalLabel={t("analytics.deliveries", { count: formatNumber(totalDeliveries) })} />
                ) : (
                    <EmptyState label={t("analytics.noTrend")} />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function TrendBarStrip({ trend, accent, totalLabel }: { trend: GuildAnalyticsTrendPoint[]; accent: string; totalLabel: string }) {
    const { t, formatDate, formatNumber } = useDashboardI18n();
    const maxDeliveries = Math.max(1, ...trend.map((item) => item.deliveries));
    const firstDate = trend[0]?.date ?? null;
    const lastDate = trend[trend.length - 1]?.date ?? null;

    return (
        <Stack spacing={1.6} sx={{ flex: 1, justifyContent: "center", minHeight: 0 }}>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${trend.length}, minmax(6px, 1fr))`,
                    gap: 0.65,
                    alignItems: "end",
                    height: 200,
                    px: 0.5,
                }}
            >
                {trend.map((point) => {
                    const height = point.deliveries === 0
                        ? 4
                        : Math.max(8, (point.deliveries / maxDeliveries) * 100);

                    return (
                        <Tooltip key={point.date} title={t("analytics.trendPoint", { date: formatShortDate(point.date, formatDate), count: formatNumber(point.deliveries) })} arrow>
                            <Box
                                sx={{
                                    height: `${height}%`,
                                    minHeight: 4,
                                    borderRadius: 999,
                                    bgcolor: point.deliveries > 0 ? accent : "rgba(255,255,255,0.12)",
                                    border: `1px solid ${point.deliveries > 0 ? alpha(accent, 0.35) : "rgba(255,255,255,0.08)"}`,
                                }}
                            />
                        </Tooltip>
                    );
                })}
            </Box>
            <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)", minWidth: 72 }}>
                    {firstDate ? formatShortDate(firstDate, formatDate) : ""}
                </Typography>
                <Chip
                    size="small"
                    label={totalLabel}
                    sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}` }}
                />
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)", minWidth: 72, textAlign: "right" }}>
                    {lastDate ? formatShortDate(lastDate, formatDate) : ""}
                </Typography>
            </Stack>
        </Stack>
    );
}

function ProviderAnalyticsPanel({
    guildId,
    providers,
    selectedProviderKey,
    onSelectProvider,
}: {
    guildId: string;
    providers: GuildAnalyticsProvider[];
    selectedProviderKey: string | null;
    onSelectProvider: (providerKey: string | null) => void;
}) {
    const { t, formatNumber } = useDashboardI18n();
    return (
        <FeaturePanel accent={dashboardAccents.settings} sx={{ p: 2.5, minHeight: 360 }}>
            <Stack spacing={2} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", minWidth: 0 }}>
                        <Timeline sx={{ color: dashboardAccents.settings }} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                                {t("analytics.providerPerformance")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                                {t("analytics.providerDescription")}
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        label={t("analytics.providers", { count: formatNumber(providers.length) })}
                        sx={{ bgcolor: alpha(dashboardAccents.settings, 0.12), color: "grey.100", border: `1px solid ${alpha(dashboardAccents.settings, 0.24)}`, flexShrink: 0 }}
                    />
                </Stack>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                {providers.length > 0 ? (
                    <Stack spacing={1.2}>
                        {providers.map((provider) => (
                            <ProviderAnalyticsRow
                                key={provider.providerKey}
                                guildId={guildId}
                                provider={provider}
                                selected={provider.providerKey === selectedProviderKey}
                                onSelectProvider={onSelectProvider}
                            />
                        ))}
                    </Stack>
                ) : (
                    <EmptyState label={t("analytics.noProviders")} />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function ProviderAnalyticsRow({
    guildId,
    provider,
    selected,
    onSelectProvider,
}: {
    guildId: string;
    provider: GuildAnalyticsProvider;
    selected: boolean;
    onSelectProvider: (providerKey: string | null) => void;
}) {
    const { t, formatDate, formatNumber, formatRelativeTime } = useDashboardI18n();
    const accent = getStatusAccent(provider.status);
    const route = providerRoutes.get(provider.providerKey);
    const href = route ? `/dashboard/${route}/${encodeURIComponent(guildId)}` : `/dashboard/settings/${encodeURIComponent(guildId)}/notifications`;

    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: selected ? alpha(accent, 0.1) : "rgba(255,255,255,0.045)", border: `1px solid ${selected ? alpha(accent, 0.35) : "rgba(255,255,255,0.08)"}`, p: 1.35 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", minWidth: 0 }}>
                        {getStatusIcon(provider.status, accent)}
                        <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getLocalizedProviderLabel(provider.providerKey, provider.providerLabel, t)}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                        {formatProviderSummaryLine(provider, formatDate, formatNumber, formatRelativeTime, t)}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", sm: "flex-end" }, flexWrap: "wrap", rowGap: 0.8 }}>
                    <Chip
                        size="small"
                        label={formatStatusLabel(provider, formatNumber, t)}
                        sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}` }}
                    />
                    <Button
                        onClick={() => onSelectProvider(selected ? null : provider.providerKey)}
                        size="small"
                        variant={selected ? "contained" : "outlined"}
                        sx={selected ? { bgcolor: accent, color: "grey.950", fontWeight: 850, "&:hover": { bgcolor: accent } } : ghostActionButtonSx(accent)}
                    >
                        {t("analytics.details")}
                    </Button>
                    <Button component={Link} href={href} size="small" variant="outlined" sx={ghostActionButtonSx(accent)}>
                        {t("analytics.manage")}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}

function ProviderDrilldownPanel({
    guildId,
    provider,
    trend,
    records,
    healthRecords,
    loading,
    error,
    onClear,
}: {
    guildId: string;
    provider: GuildAnalyticsProvider;
    trend: GuildAnalyticsTrendPoint[];
    records: NotificationDeliveryRecord[];
    healthRecords: IntegrationHealthRecord[];
    loading: boolean;
    error: string | null;
    onClear: () => void;
}) {
    const { t, formatDate, formatNumber, formatRelativeTime } = useDashboardI18n();
    const accent = getStatusAccent(provider.status);
    const route = providerRoutes.get(provider.providerKey);
    const href = route ? `/dashboard/${route}/${encodeURIComponent(guildId)}` : `/dashboard/settings/${encodeURIComponent(guildId)}/notifications`;
    const totalDeliveries = trend.reduce((total, point) => total + point.deliveries, 0);

    return (
        <FeaturePanel accent={accent} sx={{ p: 2.5, mt: 2.5 }}>
            <Stack spacing={2.2} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.4} sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 1 }}>
                    <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", minWidth: 0 }}>
                        {getStatusIcon(provider.status, accent)}
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                                {t("analytics.providerDetails", { provider: getLocalizedProviderLabel(provider.providerKey, provider.providerLabel, t) })}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                                {t("analytics.providerTotals", { configured: formatNumber(provider.configured), active: formatNumber(provider.active), paused: formatNumber(provider.paused), deliveries: formatNumber(provider.deliveries) })}
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", md: "flex-end" }, flexWrap: "wrap", rowGap: 0.8 }}>
                        <Chip
                            size="small"
                            label={formatStatusLabel(provider, formatNumber, t)}
                            sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}` }}
                        />
                        <Button component={Link} href={href} size="small" variant="outlined" sx={ghostActionButtonSx(accent)}>
                            {t("analytics.manage")}
                        </Button>
                        <Button onClick={onClear} size="small" variant="outlined" sx={ghostActionButtonSx(dashboardAccents.neutral)}>
                            {t("analytics.close")}
                        </Button>
                    </Stack>
                </Stack>
                {loading && <LinearProgress sx={{ borderRadius: 999, bgcolor: "rgba(255,255,255,0.08)" }} />}
                {error && (
                    <Alert severity="warning" icon={<WarningAmber />} sx={{ bgcolor: alpha(dashboardAccents.patchNotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.patchNotes, 0.25)}` }}>
                        {error}
                    </Alert>
                )}
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                <ProviderOutcomeSummary provider={provider} accent={accent} />
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.1fr) minmax(0, 0.9fr)" }, gap: 2.2 }}>
                    <Stack spacing={1.5}>
                        <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 900 }}>
                            {t("analytics.deliveryTrend")}
                        </Typography>
                        {trend.length > 0 ? (
                            <TrendBarStrip trend={trend} accent={accent} totalLabel={t("analytics.deliveries", { count: formatNumber(totalDeliveries) })} />
                        ) : (
                            <EmptyState label={t("analytics.noProviderTrend")} />
                        )}
                    </Stack>
                    <Stack spacing={1.5}>
                        <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 900 }}>
                            {t("analytics.currentHealth")}
                        </Typography>
                        {healthRecords.length > 0 ? (
                            <Stack spacing={1}>
                                {healthRecords.slice(0, 5).map((record) => (
                                    <ProviderDetailLine
                                        key={`${record.provider}:${record.configId}`}
                                        primary={`${getHealthRecordStatusLabel(record.status, t)} - ${record.configId}`}
                                        secondary={record.lastErrorMessage || t("analytics.lastChecked", { value: formatRelativeTimestamp(record.lastCheckedAt ?? null, formatDate, formatRelativeTime, t) })}
                                        accent={getStatusAccent(record.status === "error" ? "critical" : record.status === "warning" || record.status === "unknown" ? "warning" : "healthy")}
                                    />
                                ))}
                            </Stack>
                        ) : (
                            <EmptyState label={t("analytics.noHealth")} />
                        )}
                    </Stack>
                </Box>
                <Stack spacing={1.2}>
                    <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 900 }}>
                        {t("analytics.recentDeliveries")}
                    </Typography>
                    {records.length > 0 ? (
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                            {records.slice(0, 6).map((record) => (
                                <ProviderDetailLine
                                    key={`${record.provider}:${record.id}:${record.eventId}`}
                                    primary={record.eventId}
                                    secondary={`${record.channelId ?? t("analytics.unknownChannel")} - ${formatRelativeTimestamp(record.createdAt ?? null, formatDate, formatRelativeTime, t)}`}
                                    accent={accent}
                                />
                            ))}
                        </Box>
                    ) : (
                        <EmptyState label={t("analytics.noRecords")} />
                    )}
                </Stack>
            </Stack>
        </FeaturePanel>
    );
}

function ProviderOutcomeSummary({ provider, accent }: { provider: GuildAnalyticsProvider; accent: string }) {
    const { t, formatDate, formatNumber, formatRelativeTime } = useDashboardI18n();
    const outcomes = [
        { label: t("analytics.outcome.deliveries"), value: formatNumber(provider.deliveries), detail: t("analytics.outcome.last", { value: formatRelativeTimestamp(provider.lastDeliveryAt, formatDate, formatRelativeTime, t) }) },
        { label: t("analytics.outcome.failingConfigs"), value: formatNumber(provider.healthErrors), detail: t("analytics.outcome.warningStates", { count: formatNumber(provider.healthWarnings + provider.healthUnknown) }) },
        { label: t("analytics.outcome.currentFailures"), value: formatNumber(provider.consecutiveFailures), detail: t("analytics.outcome.fromHealth") },
        { label: t("analytics.outcome.lastFailure"), value: formatRelativeTimestamp(provider.lastFailureAt, formatDate, formatRelativeTime, t), detail: provider.lastFailureAt ? t("analytics.outcome.mostRecentFailure") : t("analytics.outcome.noFailures") },
    ];

    return (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
            {outcomes.map((item) => (
                <Box key={item.label} sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.045)", border: `1px solid ${alpha(accent, 0.16)}`, p: 1.2, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.46)", fontWeight: 850, textTransform: "uppercase", letterSpacing: 0 }}>
                        {item.label}
                    </Typography>
                    <Typography variant="body1" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.54)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.detail}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}

function ProviderDetailLine({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
    return (
        <Box sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.045)", border: `1px solid ${alpha(accent, 0.18)}`, p: 1.2, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {primary}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {secondary}
            </Typography>
        </Box>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.035)", border: "1px dashed rgba(255,255,255,0.12)", p: 2 }}>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
                {label}
            </Typography>
        </Box>
    );
}

function toAnalyticsConfigRecords(
    providerKey: string,
    providerLabel: string,
    configs: ReadonlyArray<AnalyticsSourceConfig>,
    idField: "id" | "userId" = "id"
): GuildAnalyticsConfigRecord[] {
    return configs.map((config, index) => ({
        providerKey,
        providerLabel,
        configId: getConfigId(config, idField) ?? `${providerKey}-${index}`,
        paused: config.paused,
    }));
}

function getConfigId(config: AnalyticsSourceConfig, idField: "id" | "userId"): string | null {
    const value = config[idField];
    if (value === undefined || value === null) return null;
    const id = String(value).trim();
    return id.length > 0 ? id : null;
}

function getStatusAccent(status: GuildAnalyticsHealthStatus): string {
    if (status === "critical") return dashboardAccents.quotes;
    if (status === "warning") return dashboardAccents.patchNotes;
    if (status === "healthy") return dashboardAccents.settings;
    return dashboardAccents.neutral;
}

function getStatusIcon(status: GuildAnalyticsHealthStatus, accent: string): React.ReactNode {
    if (status === "critical") return <ErrorOutlined sx={{ color: accent, fontSize: 17 }} />;
    if (status === "warning") return <WarningAmber sx={{ color: accent, fontSize: 17 }} />;
    return <CheckCircle sx={{ color: accent, fontSize: 17 }} />;
}

type DashboardTranslator = ReturnType<typeof useDashboardI18n>["t"];
type DashboardNumberFormatter = ReturnType<typeof useDashboardI18n>["formatNumber"];
type DashboardDateFormatter = ReturnType<typeof useDashboardI18n>["formatDate"];
type DashboardRelativeTimeFormatter = ReturnType<typeof useDashboardI18n>["formatRelativeTime"];

function formatStatusLabel(provider: GuildAnalyticsProvider, formatNumber: DashboardNumberFormatter, t: DashboardTranslator): string {
    if (provider.healthErrors > 0) return t("analytics.status.errors", { count: formatNumber(provider.healthErrors) });
    if (provider.healthWarnings + provider.healthUnknown > 0) return t("analytics.status.warnings", { count: formatNumber(provider.healthWarnings + provider.healthUnknown) });
    if (provider.paused > 0) return t("analytics.status.paused", { count: formatNumber(provider.paused) });
    if (provider.status === "healthy") return t("analytics.status.healthy");
    if (provider.status === "warning") return t("analytics.status.warning");
    if (provider.status === "critical") return t("analytics.status.critical");
    return t("analytics.status.quiet");
}

function formatProviderSummaryLine(provider: GuildAnalyticsProvider, formatDate: DashboardDateFormatter, formatNumber: DashboardNumberFormatter, formatRelativeTime: DashboardRelativeTimeFormatter, t: DashboardTranslator): string {
    const parts = [
        t("analytics.summary.configured", { count: formatNumber(provider.configured) }),
        t("analytics.summary.active", { count: formatNumber(provider.active) }),
        t("analytics.summary.deliveries", { count: formatNumber(provider.deliveries) }),
    ];

    if (provider.healthErrors > 0) parts.push(t("analytics.summary.failing", { count: formatNumber(provider.healthErrors) }));
    if (provider.consecutiveFailures > 0) parts.push(t("analytics.summary.currentFailures", { count: formatNumber(provider.consecutiveFailures) }));
    if (provider.lastFailureAt) parts.push(t("analytics.summary.lastFailure", { value: formatRelativeTimestamp(provider.lastFailureAt, formatDate, formatRelativeTime, t) }));
    parts.push(t("analytics.summary.lastDelivery", { value: formatRelativeTimestamp(provider.lastDeliveryAt, formatDate, formatRelativeTime, t) }));

    return parts.join(" - ");
}

function formatRelativeTimestamp(value: string | null, formatDate: DashboardDateFormatter, formatRelativeTime: DashboardRelativeTimeFormatter, t: DashboardTranslator): string {
    if (!value) return t("analytics.never");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t("analytics.unknown");
    const minutes = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
    if (minutes < 1) return t("analytics.justNow");
    if (minutes < 60) return t("analytics.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return t("analytics.hoursAgo", { count: hours });
    return formatDate(parsed, { dateStyle: "medium" });
}

function formatShortDate(value: string, formatDate: DashboardDateFormatter): string {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatDate(parsed, { month: "short", day: "numeric", timeZone: "UTC" });
}

function getLocalizedProviderLabel(providerKey: string, fallback: string, t: DashboardTranslator): string {
    if (providerKey === "twitch") return t("setupTemplates.provider.twitch");
    if (providerKey === "youtube") return t("setupTemplates.provider.youtube");
    if (providerKey === "steamnews") return t("featureNav.steamNews");
    if (providerKey === "tiktok") return t("featureNav.tiktok");
    if (providerKey === "bluesky") return t("featureNav.bluesky");
    if (providerKey === "patchnotes") return t("featureNav.patchNotes");
    if (providerKey === "anime") return t("featureNav.anime");
    if (providerKey === "birthday") return t("featureNav.birthdays");
    return fallback;
}

function getHealthRecordStatusLabel(status: IntegrationHealthRecord["status"], t: DashboardTranslator): string {
    if (status === "healthy") return t("analytics.status.healthy");
    if (status === "warning") return t("analytics.status.warning");
    if (status === "error") return t("analytics.status.critical");
    return t("analytics.unknown");
}

function normalizeProviderKey(provider: string): string {
    const normalized = provider.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "patchnote" || normalized === "patchnotes") return "patchnotes";
    if (normalized === "birthdays") return "birthday";
    return normalized || "unknown";
}
