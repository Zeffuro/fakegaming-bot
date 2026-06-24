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
        { label: "Dashboard", href: `/dashboard/${encodedGuildId}` },
        { label: "Analytics", href: null },
    ] : null;

    return (
        <DashboardLayout guild={guild} currentModule="analytics" currentTrail={trail} maxWidth="xl" loading={guildsLoading}>
            {guild && (
                <FeatureShell accent={dashboardAccents.commands} secondaryAccent={dashboardAccents.settings}>
                    <FeatureHero
                        icon={<Timeline />}
                        eyebrow="Analytics"
                        title="Notification Analytics"
                        description="Delivery history, provider health, and notification setup coverage for this server."
                        accent={dashboardAccents.commands}
                        secondaryAccent={dashboardAccents.settings}
                        stats={[
                            { label: "Configured Feeds", value: loading ? "..." : analytics.totalConfigured },
                            { label: "Deliveries Recorded", value: historyApi.loading ? "..." : analytics.totalDeliveries },
                            { label: "Health Issues", value: loading ? "..." : analytics.healthErrors + analytics.healthWarnings },
                        ]}
                        actions={(
                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                                <Button
                                    component={Link}
                                    href={`/dashboard/settings/${encodedGuildId}/notifications`}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(dashboardAccents.commands)}
                                >
                                    Open Notifications
                                </Button>
                                <Button
                                    disabled={loading}
                                    onClick={exportAnalytics}
                                    startIcon={<Download />}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    Export CSV
                                </Button>
                            </Stack>
                        )}
                    />

                    {loading && <LinearProgress sx={{ mb: 2.5, borderRadius: 999, bgcolor: "rgba(255,255,255,0.08)" }} />}
                    {errors.length > 0 && (
                        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2.5, bgcolor: alpha(dashboardAccents.patchNotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.patchNotes, 0.25)}` }}>
                            Some analytics data could not be loaded: {errors.join(" / ")}
                        </Alert>
                    )}

                    <AnalyticsWindowSelector value={analyticsWindowDays} onChange={updateAnalyticsWindowDays} />

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2, mb: 2.5 }}>
                        <MetricPanel label="Active feeds" value={analytics.activeConfigs} accent={dashboardAccents.settings} icon={<CheckCircle />} />
                        <MetricPanel label="Paused feeds" value={analytics.pausedConfigs} accent={dashboardAccents.commands} icon={<PauseCircle />} />
                        <MetricPanel label="Health errors" value={analytics.healthErrors} accent={dashboardAccents.quotes} icon={<ErrorOutlined />} />
                        <MetricPanel label="Last delivery" value={formatRelativeTimestamp(analytics.lastDeliveryAt)} accent={dashboardAccents.youtube} icon={<NotificationsActive />} />
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
    const handleChange = (_event: React.MouseEvent<HTMLElement>, nextValue: unknown): void => {
        if (typeof nextValue !== "number" || !isGuildAnalyticsWindowDays(nextValue)) return;
        onChange(nextValue);
    };

    return (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)", fontWeight: 850, letterSpacing: 0, textTransform: "uppercase" }}>
                Analytics window
            </Typography>
            <ToggleButtonGroup
                exclusive
                size="small"
                value={value}
                onChange={handleChange}
                aria-label="Analytics window"
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
                    <ToggleButton key={days} value={days} aria-label={`${days} day analytics window`}>
                        {days}d
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>
        </Stack>
    );
}

function DeliveryTrendPanel({ trend, days }: { trend: GuildAnalyticsTrendPoint[]; days: number }) {
    const totalDeliveries = trend.reduce((total, point) => total + point.deliveries, 0);

    return (
        <FeaturePanel accent={dashboardAccents.commands} sx={{ p: 2.5, minHeight: 360 }}>
            <Stack spacing={2} sx={{ position: "relative", height: "100%" }}>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                    <BarChart sx={{ color: dashboardAccents.commands }} />
                    <Box>
                        <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                            Delivery trend
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                            Last {trend.length || days} UTC days, independent of the recent-record page size.
                        </Typography>
                    </Box>
                </Stack>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                {trend.length > 0 ? (
                    <TrendBarStrip trend={trend} accent={dashboardAccents.commands} totalLabel={`${totalDeliveries} deliveries`} />
                ) : (
                    <EmptyState label="No delivery trend data is available yet." />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function TrendBarStrip({ trend, accent, totalLabel }: { trend: GuildAnalyticsTrendPoint[]; accent: string; totalLabel: string }) {
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
                        <Tooltip key={point.date} title={`${formatShortDate(point.date)}: ${point.deliveries} deliveries`} arrow>
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
                    {firstDate ? formatShortDate(firstDate) : ""}
                </Typography>
                <Chip
                    size="small"
                    label={totalLabel}
                    sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}` }}
                />
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)", minWidth: 72, textAlign: "right" }}>
                    {lastDate ? formatShortDate(lastDate) : ""}
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
    return (
        <FeaturePanel accent={dashboardAccents.settings} sx={{ p: 2.5, minHeight: 360 }}>
            <Stack spacing={2} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", minWidth: 0 }}>
                        <Timeline sx={{ color: dashboardAccents.settings }} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900, lineHeight: 1.15 }}>
                                Provider performance
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                                Setup volume, delivery counts, and current health by provider.
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        label={`${providers.length} providers`}
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
                    <EmptyState label="No notification setup or delivery history found yet." />
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
                            {provider.providerLabel}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                        {formatProviderSummaryLine(provider)}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", sm: "flex-end" }, flexWrap: "wrap", rowGap: 0.8 }}>
                    <Chip
                        size="small"
                        label={formatStatusLabel(provider)}
                        sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}` }}
                    />
                    <Button
                        onClick={() => onSelectProvider(selected ? null : provider.providerKey)}
                        size="small"
                        variant={selected ? "contained" : "outlined"}
                        sx={selected ? { bgcolor: accent, color: "grey.950", fontWeight: 850, "&:hover": { bgcolor: accent } } : ghostActionButtonSx(accent)}
                    >
                        Details
                    </Button>
                    <Button component={Link} href={href} size="small" variant="outlined" sx={ghostActionButtonSx(accent)}>
                        Manage
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
                                {provider.providerLabel} details
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                                {provider.configured} configured - {provider.active} active - {provider.paused} paused - {provider.deliveries} total deliveries
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", md: "flex-end" }, flexWrap: "wrap", rowGap: 0.8 }}>
                        <Chip
                            size="small"
                            label={formatStatusLabel(provider)}
                            sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}` }}
                        />
                        <Button component={Link} href={href} size="small" variant="outlined" sx={ghostActionButtonSx(accent)}>
                            Manage
                        </Button>
                        <Button onClick={onClear} size="small" variant="outlined" sx={ghostActionButtonSx(dashboardAccents.neutral)}>
                            Close
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
                            Delivery trend
                        </Typography>
                        {trend.length > 0 ? (
                            <TrendBarStrip trend={trend} accent={accent} totalLabel={`${totalDeliveries} provider deliveries`} />
                        ) : (
                            <EmptyState label="No delivery trend data is available for this provider yet." />
                        )}
                    </Stack>
                    <Stack spacing={1.5}>
                        <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 900 }}>
                            Current health
                        </Typography>
                        {healthRecords.length > 0 ? (
                            <Stack spacing={1}>
                                {healthRecords.slice(0, 5).map((record) => (
                                    <ProviderDetailLine
                                        key={`${record.provider}:${record.configId}`}
                                        primary={`${record.status} - ${record.configId}`}
                                        secondary={record.lastErrorMessage || `Last checked ${formatRelativeTimestamp(record.lastCheckedAt ?? null)}`}
                                        accent={getStatusAccent(record.status === "error" ? "critical" : record.status === "warning" || record.status === "unknown" ? "warning" : "healthy")}
                                    />
                                ))}
                            </Stack>
                        ) : (
                            <EmptyState label="No health records have been reported for this provider." />
                        )}
                    </Stack>
                </Box>
                <Stack spacing={1.2}>
                    <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 900 }}>
                        Recent deliveries
                    </Typography>
                    {records.length > 0 ? (
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                            {records.slice(0, 6).map((record) => (
                                <ProviderDetailLine
                                    key={`${record.provider}:${record.id}:${record.eventId}`}
                                    primary={record.eventId}
                                    secondary={`${record.channelId ?? "unknown channel"} - ${formatRelativeTimestamp(record.createdAt ?? null)}`}
                                    accent={accent}
                                />
                            ))}
                        </Box>
                    ) : (
                        <EmptyState label="No recent delivery records match this provider." />
                    )}
                </Stack>
            </Stack>
        </FeaturePanel>
    );
}

function ProviderOutcomeSummary({ provider, accent }: { provider: GuildAnalyticsProvider; accent: string }) {
    const outcomes = [
        { label: "Deliveries", value: String(provider.deliveries), detail: `last ${formatRelativeTimestamp(provider.lastDeliveryAt)}` },
        { label: "Failing configs", value: String(provider.healthErrors), detail: `${provider.healthWarnings + provider.healthUnknown} warning state${provider.healthWarnings + provider.healthUnknown === 1 ? "" : "s"}` },
        { label: "Current failures", value: String(provider.consecutiveFailures), detail: "from integration health" },
        { label: "Last failure", value: formatRelativeTimestamp(provider.lastFailureAt), detail: provider.lastFailureAt ? "most recent provider failure" : "no failures recorded" },
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

function formatStatusLabel(provider: GuildAnalyticsProvider): string {
    if (provider.healthErrors > 0) return `${provider.healthErrors} errors`;
    if (provider.healthWarnings + provider.healthUnknown > 0) return `${provider.healthWarnings + provider.healthUnknown} warnings`;
    if (provider.paused > 0) return `${provider.paused} paused`;
    return provider.status;
}

function formatProviderSummaryLine(provider: GuildAnalyticsProvider): string {
    const parts = [
        `${provider.configured} configured`,
        `${provider.active} active`,
        `${provider.deliveries} deliveries`,
    ];

    if (provider.healthErrors > 0) parts.push(`${provider.healthErrors} failing`);
    if (provider.consecutiveFailures > 0) parts.push(`${provider.consecutiveFailures} current failures`);
    if (provider.lastFailureAt) parts.push(`last failure ${formatRelativeTimestamp(provider.lastFailureAt)}`);
    parts.push(`last delivery ${formatRelativeTimestamp(provider.lastDeliveryAt)}`);

    return parts.join(" - ");
}

function formatRelativeTimestamp(value: string | null): string {
    if (!value) return "never";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "unknown";
    const minutes = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return parsed.toLocaleDateString();
}

function formatShortDate(value: string): string {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function normalizeProviderKey(provider: string): string {
    const normalized = provider.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "patchnote" || normalized === "patchnotes") return "patchnotes";
    if (normalized === "birthdays") return "birthday";
    return normalized || "unknown";
}
