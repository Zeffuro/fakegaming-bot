"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, Divider, LinearProgress, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    BarChart,
    CheckCircle,
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
    type GuildAnalyticsConfigRecord,
    type GuildAnalyticsHealthStatus,
    type GuildAnalyticsProvider,
    type GuildAnalyticsTrendPoint,
} from "@/lib/guildNotificationAnalytics";

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

export default function GuildAnalyticsPage() {
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const resolvedGuildId = guildId as string;
    const encodedGuildId = encodeURIComponent(resolvedGuildId);
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
    const historyApi = useGuildNotificationHistory(resolvedGuildId, { enabled: guildReady, limit: 100 });

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
    }), [configs, healthApi.records, historyApi.history]);
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
                            <Button
                                component={Link}
                                href={`/dashboard/settings/${encodedGuildId}/notifications`}
                                variant="outlined"
                                sx={ghostActionButtonSx(dashboardAccents.commands)}
                            >
                                Open Notifications
                            </Button>
                        )}
                    />

                    {loading && <LinearProgress sx={{ mb: 2.5, borderRadius: 999, bgcolor: "rgba(255,255,255,0.08)" }} />}
                    {errors.length > 0 && (
                        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2.5, bgcolor: alpha(dashboardAccents.patchNotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.patchNotes, 0.25)}` }}>
                            Some analytics data could not be loaded: {errors.join(" / ")}
                        </Alert>
                    )}

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2, mb: 2.5 }}>
                        <MetricPanel label="Active feeds" value={analytics.activeConfigs} accent={dashboardAccents.settings} icon={<CheckCircle />} />
                        <MetricPanel label="Paused feeds" value={analytics.pausedConfigs} accent={dashboardAccents.commands} icon={<PauseCircle />} />
                        <MetricPanel label="Health errors" value={analytics.healthErrors} accent={dashboardAccents.quotes} icon={<ErrorOutlined />} />
                        <MetricPanel label="Last delivery" value={formatRelativeTimestamp(analytics.lastDeliveryAt)} accent={dashboardAccents.youtube} icon={<NotificationsActive />} />
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 0.95fr) minmax(0, 1.35fr)" }, gap: 2.5 }}>
                        <DeliveryTrendPanel trend={analytics.trend} />
                        <ProviderAnalyticsPanel guildId={resolvedGuildId} providers={analytics.providers} />
                    </Box>
                </FeatureShell>
            )}
        </DashboardLayout>
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

function DeliveryTrendPanel({ trend }: { trend: GuildAnalyticsTrendPoint[] }) {
    const maxDeliveries = Math.max(1, ...trend.map((item) => item.deliveries));

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
                            Recent notification records grouped by UTC day.
                        </Typography>
                    </Box>
                </Stack>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                <Stack spacing={1.1} sx={{ flex: 1, justifyContent: "center" }}>
                    {trend.map((point) => (
                        <Stack key={point.date} direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)", width: 76, flexShrink: 0 }}>
                                {formatShortDate(point.date)}
                            </Typography>
                            <Box sx={{ flex: 1, minWidth: 0, height: 12, borderRadius: 999, bgcolor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                <Box sx={{ width: `${Math.max(4, (point.deliveries / maxDeliveries) * 100)}%`, height: "100%", borderRadius: 999, bgcolor: dashboardAccents.commands }} />
                            </Box>
                            <Typography variant="caption" sx={{ color: "grey.100", width: 28, textAlign: "right", flexShrink: 0, fontWeight: 800 }}>
                                {point.deliveries}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
            </Stack>
        </FeaturePanel>
    );
}

function ProviderAnalyticsPanel({ guildId, providers }: { guildId: string; providers: GuildAnalyticsProvider[] }) {
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
                            <ProviderAnalyticsRow key={provider.providerKey} guildId={guildId} provider={provider} />
                        ))}
                    </Stack>
                ) : (
                    <EmptyState label="No notification setup or delivery history found yet." />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function ProviderAnalyticsRow({ guildId, provider }: { guildId: string; provider: GuildAnalyticsProvider }) {
    const accent = getStatusAccent(provider.status);
    const route = providerRoutes.get(provider.providerKey);
    const href = route ? `/dashboard/${route}/${encodeURIComponent(guildId)}` : `/dashboard/settings/${encodeURIComponent(guildId)}/notifications`;

    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", p: 1.35 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", minWidth: 0 }}>
                        {getStatusIcon(provider.status, accent)}
                        <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {provider.providerLabel}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35 }}>
                        {provider.configured} configured - {provider.active} active - {provider.deliveries} deliveries - last {formatRelativeTimestamp(provider.lastDeliveryAt)}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", sm: "flex-end" }, flexWrap: "wrap", rowGap: 0.8 }}>
                    <Chip
                        size="small"
                        label={formatStatusLabel(provider)}
                        sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.24)}` }}
                    />
                    <Button component={Link} href={href} size="small" variant="outlined" sx={ghostActionButtonSx(accent)}>
                        Manage
                    </Button>
                </Stack>
            </Stack>
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
