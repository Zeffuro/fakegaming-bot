"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { Box, Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    ArrowForward,
    Block,
    Cake,
    CheckCircle,
    Download,
    ErrorOutlined,
    FormatQuote,
    InfoOutlined,
    NotificationsActive,
    PowerSettingsNew,
    Settings,
    Timeline,
    Tune,
    UploadFile,
    WarningAmber,
} from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useAnimeConfigs } from "@/components/hooks/useAnime";
import { useBirthdays } from "@/components/hooks/useBirthdays";
import { useBlueskyConfigs } from "@/components/hooks/useBluesky";
import { useGuildCommands } from "@/components/hooks/useGuildCommands";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useGuildModules } from "@/components/hooks/useGuildModules";
import { useIntegrationHealth } from "@/components/hooks/useIntegrationHealth";
import { usePatchSubscriptions } from "@/components/hooks/usePatchSubscriptions";
import { useSteamNewsConfigs } from "@/components/hooks/useSteamNews";
import { useTikTokConfigs } from "@/components/hooks/useTikTok";
import { useTwitchConfigs } from "@/components/hooks/useTwitch";
import { useYouTubeConfigs } from "@/components/hooks/useYouTube";
import { BOT_TREE } from "@/lib/commands";
import { buildNotificationSetupReview } from "@/lib/notificationSetupReview";
import {
    buildServerSettingsStatus,
    type ServerCapabilityChecklistItem,
    type ServerCapabilitySeverity,
    type ServerModuleState,
    type ServerModuleStatus,
    type ServerProviderConfigInput,
    type ServerProviderState,
    type ServerProviderStatus,
    type ServerSettingsStatus,
} from "@/lib/serverSettingsStatus";
import { SettingsCard } from "@/components/SettingsCard";

interface SettingsDestination {
    title: string;
    description: string;
    href: string;
    accent: string;
    icon: React.ReactNode;
    actionLabel: string;
    chipLabel?: string;
}

export default function GuildSettingsPage() {
    const { guild, guildsLoading, guildId } = useGuildFromParams();
    const guildReady = Boolean(guild);
    const encodedGuildId = encodeURIComponent(guildId as string);
    const notificationSetupHref = `/dashboard/settings/${encodedGuildId}/notifications`;
    const notificationTransferHref = `${notificationSetupHref}#notification-transfer`;
    const commandsApi = useGuildCommands(guildId as string);
    const modulesApi = useGuildModules(guildId as string);
    const integrationHealth = useIntegrationHealth(guildId as string, undefined, { enabled: guildReady });
    const twitchApi = useTwitchConfigs(guildId as string, { enabled: guildReady });
    const youtubeApi = useYouTubeConfigs(guildId as string, { enabled: guildReady });
    const steamNewsApi = useSteamNewsConfigs(guildId as string, { enabled: guildReady });
    const patchApi = usePatchSubscriptions(guildId as string, { enabled: guildReady });
    const tiktokApi = useTikTokConfigs(guildId as string, { enabled: guildReady });
    const blueskyApi = useBlueskyConfigs(guildId as string, { enabled: guildReady });
    const birthdayApi = useBirthdays(guildId as string, { enabled: guildReady });
    const animeApi = useAnimeConfigs(guildId as string, { enabled: guildReady });

    useEffect(() => {
        if (!guildReady || !guildId) return;
        void commandsApi.fetchDisabledCommands();
        void modulesApi.fetchDisabledModules();
    }, [commandsApi.fetchDisabledCommands, guildId, guildReady, modulesApi.fetchDisabledModules]);

    const notificationRecords = useMemo(() => ({
        twitch: asReviewRecords(twitchApi.configs),
        youtube: asReviewRecords(youtubeApi.configs),
        tiktok: asReviewRecords(tiktokApi.configs),
        bluesky: asReviewRecords(blueskyApi.configs),
        steamNews: asReviewRecords(steamNewsApi.configs),
        patchNotes: asReviewRecords(patchApi.configs),
        anime: asReviewRecords(animeApi.configs),
        birthdays: asReviewRecords(birthdayApi.birthdays),
    }), [
        animeApi.configs,
        birthdayApi.birthdays,
        blueskyApi.configs,
        patchApi.configs,
        steamNewsApi.configs,
        tiktokApi.configs,
        twitchApi.configs,
        youtubeApi.configs,
    ]);
    const setupReview = useMemo(() => buildNotificationSetupReview(notificationRecords), [notificationRecords]);
    const providerConfigs = useMemo<ServerProviderConfigInput[]>(() => ([
        toProviderConfig("twitch", "Twitch", "twitch", twitchApi.configs, `/dashboard/twitch/${encodedGuildId}`),
        toProviderConfig("youtube", "YouTube", "youtube", youtubeApi.configs, `/dashboard/youtube/${encodedGuildId}`),
        toProviderConfig("tiktok", "TikTok", "tiktok", tiktokApi.configs, `/dashboard/tiktok/${encodedGuildId}`),
        toProviderConfig("bluesky", "Bluesky", "bluesky", blueskyApi.configs, `/dashboard/bluesky/${encodedGuildId}`),
        toProviderConfig("steamnews", "Steam News", "steam", steamNewsApi.configs, `/dashboard/steam-news/${encodedGuildId}`),
        toProviderConfig("patchnotes", "Patch Notes", "patchnotes", patchApi.configs, `/dashboard/patch-notes/${encodedGuildId}`),
        toProviderConfig("anime", "Anime", "anime", animeApi.configs, `/dashboard/anime/${encodedGuildId}`),
        toProviderConfig("birthday", "Birthdays", "birthdays", birthdayApi.birthdays, `/dashboard/birthdays/${encodedGuildId}`),
    ]), [
        animeApi.configs,
        birthdayApi.birthdays,
        blueskyApi.configs,
        encodedGuildId,
        patchApi.configs,
        steamNewsApi.configs,
        tiktokApi.configs,
        twitchApi.configs,
        youtubeApi.configs,
    ]);
    const serverStatus = useMemo(() => buildServerSettingsStatus({
        tree: BOT_TREE,
        disabledModules: modulesApi.disabledModules,
        disabledCommands: commandsApi.disabledCommands,
        providerConfigs,
        healthRecords: integrationHealth.records,
        notificationReview: setupReview,
        guildId: guildId as string,
    }), [
        commandsApi.disabledCommands,
        guildId,
        integrationHealth.records,
        modulesApi.disabledModules,
        providerConfigs,
        setupReview,
    ]);
    const statusLoading = twitchApi.loading
        || youtubeApi.loading
        || steamNewsApi.loading
        || patchApi.loading
        || tiktokApi.loading
        || blueskyApi.loading
        || birthdayApi.loading
        || animeApi.loading
        || integrationHealth.loading;
    const statusErrors = [
        commandsApi.error,
        modulesApi.error,
        integrationHealth.error,
        twitchApi.error,
        youtubeApi.error,
        steamNewsApi.error,
        patchApi.error,
        tiktokApi.error,
        blueskyApi.error,
        birthdayApi.error,
        animeApi.error,
    ].filter((message): message is string => Boolean(message));

    if (!guild && !guildsLoading) {
        return <GuildAccessError />;
    }

    const destinations: SettingsDestination[] = [
        {
            title: "Notification Setup",
            description: "Manage feed routing, cooldowns, quiet hours, import/export, and duplicate setup review.",
            href: notificationSetupHref,
            accent: dashboardAccents.settings,
            icon: <NotificationsActive />,
            actionLabel: "Open Notifications",
            chipLabel: "Routing",
        },
        {
            title: "Delivery Analytics",
            description: "Review notification history, provider health, delivery rates, and provider trends.",
            href: `/dashboard/analytics/${encodedGuildId}`,
            accent: dashboardAccents.neutral,
            icon: <Timeline />,
            actionLabel: "Open Analytics",
            chipLabel: "Health",
        },
        {
            title: "Command Access",
            description: "Enable or disable bot modules and commands that are available to this server.",
            href: `/dashboard/commands/${encodedGuildId}`,
            accent: dashboardAccents.commands,
            icon: <Block />,
            actionLabel: "Manage Commands",
            chipLabel: "Access",
        },
        {
            title: "Quote Library",
            description: "View, add, search, and prune the quotes stored for this community.",
            href: `/dashboard/quotes/${encodedGuildId}`,
            accent: dashboardAccents.quotes,
            icon: <FormatQuote />,
            actionLabel: "Manage Quotes",
            chipLabel: "Content",
        },
        {
            title: "Birthday Calendar",
            description: "Maintain member birthdays and their announcement destinations.",
            href: `/dashboard/birthdays/${encodedGuildId}`,
            accent: dashboardAccents.birthdays,
            icon: <Cake />,
            actionLabel: "Manage Birthdays",
            chipLabel: "Community",
        },
        {
            title: "Server Overview",
            description: "Return to the full dashboard index for every available module on this server.",
            href: `/dashboard/${encodedGuildId}`,
            accent: dashboardAccents.anime,
            icon: <Tune />,
            actionLabel: "Open Overview",
            chipLabel: "Index",
        },
    ];

    return (
        <DashboardLayout guild={guild} currentModule="settings" maxWidth="xl" loading={guildsLoading}>
            {!guildsLoading && guild && (
                <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.commands}>
                    <FeatureHero
                        icon={<Settings />}
                        eyebrow="Settings"
                        title="Server Control Center"
                        description="A hub for the settings that exist today: notification setup, delivery analytics, command availability, and community content."
                        accent={dashboardAccents.settings}
                        secondaryAccent={dashboardAccents.commands}
                        stats={[
                            { label: "Commands Enabled", value: `${serverStatus.summary.enabledCommands}/${serverStatus.summary.totalCommands}` },
                            { label: "Configured Feeds", value: serverStatus.summary.configuredIntegrations },
                            { label: "Review Findings", value: serverStatus.summary.notificationFindings },
                            { label: "Members", value: guild.member_count ?? "N/A" },
                        ]}
                        actions={(
                            <Button
                                component={Link}
                                href={notificationSetupHref}
                                variant="contained"
                                startIcon={<NotificationsActive />}
                                sx={primaryActionButtonSx(dashboardAccents.settings)}
                            >
                                Open Notifications
                            </Button>
                        )}
                    />

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.6fr) minmax(320px, 0.9fr)" }, gap: 3 }}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                            {destinations.map((destination) => (
                                <SettingsDestinationCard key={destination.title} destination={destination} />
                            ))}
                        </Box>

                        <Stack spacing={3}>
                            <SettingsCard
                                title="Server Snapshot"
                                description="Discord remains the source of truth for roles, channels, permissions, and member data."
                                accent={dashboardAccents.settings}
                            >
                                <Stack spacing={1.5}>
                                    <SnapshotRow label="Server" value={guild.name} />
                                    <SnapshotRow label="Server ID" value={guildId as string} />
                                    <SnapshotRow label="Members" value={String(guild.member_count ?? "N/A")} />
                                </Stack>
                            </SettingsCard>

                            <SettingsCard
                                title="Capability Checklist"
                                description="Missing destinations, provider health, setup review, paused routes, and command overrides."
                                accent={serverStatus.capabilityChecklist.issueCount > 0 ? dashboardAccents.patchNotes : dashboardAccents.settings}
                            >
                                <CapabilityChecklist status={serverStatus} />
                            </SettingsCard>

                            <SettingsCard
                                title="Live Module Status"
                                description="Effective command availability by module, including disabled modules and per-command overrides."
                                accent={dashboardAccents.commands}
                            >
                                <LiveModuleStatus status={serverStatus} loading={statusLoading} errors={statusErrors} />
                            </SettingsCard>

                            <SettingsCard
                                title="Integration Setup"
                                description="Configured notification providers with paused routes and health signals."
                                accent={dashboardAccents.settings}
                            >
                                <IntegrationSetupStatus status={serverStatus} loading={statusLoading} />
                            </SettingsCard>

                            <SettingsCard
                                title="Notification Review"
                                description="Duplicate routes, same-feed multi-channel overlap, and crowded destination channels."
                                accent={dashboardAccents.settings}
                            >
                                <NotificationReviewStatus status={serverStatus} href={notificationSetupHref} />
                            </SettingsCard>

                            <SettingsCard
                                title="Notification Transfer"
                                description="Jump to the notification setup import and export controls."
                                accent={dashboardAccents.settings}
                            >
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                    <Button
                                        component={Link}
                                        href={notificationTransferHref}
                                        variant="outlined"
                                        startIcon={<UploadFile />}
                                        sx={ghostActionButtonSx(dashboardAccents.settings)}
                                    >
                                        Import JSON
                                    </Button>
                                    <Button
                                        component={Link}
                                        href={notificationTransferHref}
                                        variant="outlined"
                                        startIcon={<Download />}
                                        sx={ghostActionButtonSx(dashboardAccents.settings)}
                                    >
                                        Export JSON
                                    </Button>
                                </Stack>
                            </SettingsCard>
                        </Stack>
                    </Box>
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}

function CapabilityChecklist({ status }: { status: ServerSettingsStatus }) {
    return (
        <Stack spacing={1.25}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                <StatusChip label={status.capabilityChecklist.statusLabel} accent={status.capabilityChecklist.issueCount > 0 ? dashboardAccents.patchNotes : dashboardAccents.settings} />
                <StatusChip label={`${status.summary.missingChannels} missing channels`} accent={status.summary.missingChannels > 0 ? dashboardAccents.quotes : dashboardAccents.neutral} />
                <StatusChip label={`${status.summary.healthIssues} health`} accent={status.summary.healthIssues > 0 ? dashboardAccents.patchNotes : dashboardAccents.neutral} />
            </Stack>
            {status.capabilityChecklist.items.map((item) => (
                <CapabilityChecklistRow key={item.id} item={item} />
            ))}
        </Stack>
    );
}

function CapabilityChecklistRow({ item }: { item: ServerCapabilityChecklistItem }) {
    return (
        <StatusRow
            icon={getCapabilitySeverityIcon(item.severity)}
            accent={getCapabilitySeverityAccent(item.severity)}
            title={item.title}
            detail={item.detail}
            chipLabel={item.statusLabel}
            href={item.href}
            ariaLabel={`Open ${item.title}`}
        />
    );
}

function LiveModuleStatus({ status, loading, errors }: { status: ServerSettingsStatus; loading: boolean; errors: string[] }) {
    return (
        <Stack spacing={1.25}>
            <StatusLoadingBar loading={loading} />
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                <StatusChip label={`${status.summary.activeModules} active`} accent={dashboardAccents.settings} />
                <StatusChip label={`${status.summary.partialModules} review`} accent={dashboardAccents.patchNotes} />
                <StatusChip label={`${status.summary.disabledModules} disabled`} accent={dashboardAccents.quotes} />
            </Stack>
            {errors.length > 0 ? (
                <Typography variant="caption" sx={{ color: dashboardAccents.patchNotes, display: "block" }}>
                    {errors[0]}
                </Typography>
            ) : null}
            {status.modules.map((module) => (
                <ModuleStatusRow key={module.moduleName} module={module} />
            ))}
        </Stack>
    );
}

function ModuleStatusRow({ module }: { module: ServerModuleStatus }) {
    const accent = getModuleStateAccent(module.state);
    return (
        <StatusRow
            icon={getModuleStateIcon(module.state)}
            accent={accent}
            title={module.title}
            detail={module.detail}
            chipLabel={module.statusLabel}
            href={module.href}
            ariaLabel={`Open command controls for ${module.title}`}
        />
    );
}

function IntegrationSetupStatus({ status, loading }: { status: ServerSettingsStatus; loading: boolean }) {
    return (
        <Stack spacing={1.25}>
            <StatusLoadingBar loading={loading} />
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                <StatusChip label={`${status.summary.activeIntegrations} active`} accent={dashboardAccents.settings} />
                <StatusChip label={`${status.summary.pausedIntegrations} paused`} accent={dashboardAccents.patchNotes} />
                <StatusChip label={`${status.summary.healthIssues} health`} accent={status.summary.healthIssues > 0 ? dashboardAccents.quotes : dashboardAccents.neutral} />
            </Stack>
            {status.providers.length === 0 ? (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
                    No notification integrations are configured yet.
                </Typography>
            ) : (
                status.providers.map((provider) => (
                    <ProviderStatusRow key={provider.providerKey} provider={provider} />
                ))
            )}
        </Stack>
    );
}

function ProviderStatusRow({ provider }: { provider: ServerProviderStatus }) {
    const accent = getProviderStateAccent(provider.state);
    const healthIssues = provider.healthErrors + provider.healthWarnings + provider.healthUnknown;
    return (
        <StatusRow
            icon={getProviderStateIcon(provider.state)}
            accent={accent}
            title={provider.providerLabel}
            detail={`${provider.active}/${provider.configured} active${provider.paused > 0 ? `, ${provider.paused} paused` : ""}${provider.missingChannels > 0 ? `, ${provider.missingChannels} missing ${provider.missingChannels === 1 ? "channel" : "channels"}` : ""}${healthIssues > 0 ? `, ${healthIssues} health ${healthIssues === 1 ? "issue" : "issues"}` : ""}.`}
            chipLabel={getProviderStateLabel(provider.state)}
            href={provider.href}
            ariaLabel={`Open ${provider.providerLabel} setup`}
        />
    );
}

function NotificationReviewStatus({ status, href }: { status: ServerSettingsStatus; href: string }) {
    const review = status.notificationReview;
    const accent = review.totalFindings > 0 ? dashboardAccents.patchNotes : dashboardAccents.settings;
    return (
        <Stack spacing={1.25}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                <StatusChip label={`${review.duplicateRoutes} duplicates`} accent={review.duplicateRoutes > 0 ? dashboardAccents.patchNotes : dashboardAccents.neutral} />
                <StatusChip label={`${review.multiChannelFeeds} overlaps`} accent={review.multiChannelFeeds > 0 ? dashboardAccents.patchNotes : dashboardAccents.neutral} />
                <StatusChip label={`${review.busyChannels} busy`} accent={review.busyChannels > 0 ? dashboardAccents.patchNotes : dashboardAccents.neutral} />
            </Stack>
            <StatusRow
                icon={review.totalFindings > 0 ? <WarningAmber fontSize="small" /> : <CheckCircle fontSize="small" />}
                accent={accent}
                title={review.totalFindings === 0 ? "No setup findings" : "Setup review needs attention"}
                detail={review.totalFindings === 0 ? "No duplicate routes or crowded destination channels were detected." : `${review.statusLabel} detected across notification routing.`}
                chipLabel={review.statusLabel}
                href={href}
                ariaLabel="Open notification setup review"
            />
        </Stack>
    );
}

function SettingsDestinationCard({ destination }: { destination: SettingsDestination }) {
    return (
        <SettingsCard
            title={destination.title}
            description={destination.description}
            accent={destination.accent}
        >
            <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            display: "grid",
                            placeItems: "center",
                            color: destination.accent,
                            bgcolor: alpha(destination.accent, 0.14),
                            border: `1px solid ${alpha(destination.accent, 0.28)}`,
                            flex: "0 0 auto",
                        }}
                    >
                        {destination.icon}
                    </Box>
                    {destination.chipLabel ? (
                        <Chip
                            size="small"
                            label={destination.chipLabel}
                            sx={{
                                color: "rgba(255,255,255,0.78)",
                                bgcolor: alpha(destination.accent, 0.10),
                                border: `1px solid ${alpha(destination.accent, 0.20)}`,
                            }}
                        />
                    ) : null}
                </Stack>

                <Button
                    component={Link}
                    href={destination.href}
                    variant="outlined"
                    endIcon={<ArrowForward />}
                    sx={ghostActionButtonSx(destination.accent)}
                >
                    {destination.actionLabel}
                </Button>
            </Stack>
        </SettingsCard>
    );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 800, textAlign: "right", overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
    );
}

function StatusRow({
    icon,
    accent,
    title,
    detail,
    chipLabel,
    href,
    ariaLabel,
}: {
    icon: React.ReactNode;
    accent: string;
    title: string;
    detail: string;
    chipLabel: string;
    href: string;
    ariaLabel: string;
}) {
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 1.5, px: 1.5, py: 1.25, borderRadius: 2, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", minWidth: 0 }}>
                <Box sx={{ color: accent, mt: 0.1, flexShrink: 0, display: "grid", placeItems: "center" }}>
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
                        <Typography variant="body2" sx={{ color: "grey.50", fontWeight: 850, overflowWrap: "anywhere" }}>
                            {title}
                        </Typography>
                        <Chip
                            size="small"
                            label={chipLabel}
                            sx={{
                                height: 22,
                                color: "rgba(255,255,255,0.78)",
                                bgcolor: alpha(accent, 0.10),
                                border: `1px solid ${alpha(accent, 0.20)}`,
                            }}
                        />
                    </Stack>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", display: "block", mt: 0.25, overflowWrap: "anywhere" }}>
                        {detail}
                    </Typography>
                </Box>
            </Stack>
            <Button
                component={Link}
                href={href}
                variant="text"
                aria-label={ariaLabel}
                sx={{ ...ghostActionButtonSx(accent), minWidth: 40, px: 1.25 }}
            >
                <ArrowForward fontSize="small" />
            </Button>
        </Box>
    );
}

function StatusChip({ label, accent }: { label: string; accent: string }) {
    return (
        <Chip
            size="small"
            label={label}
            sx={{
                color: "rgba(255,255,255,0.78)",
                bgcolor: alpha(accent, 0.10),
                border: `1px solid ${alpha(accent, 0.20)}`,
            }}
        />
    );
}

function StatusLoadingBar({ loading }: { loading: boolean }) {
    return loading ? (
        <LinearProgress
            sx={{
                height: 4,
                borderRadius: 999,
                bgcolor: "rgba(255,255,255,0.08)",
                "& .MuiLinearProgress-bar": { bgcolor: dashboardAccents.settings },
            }}
        />
    ) : null;
}

function getCapabilitySeverityAccent(severity: ServerCapabilitySeverity): string {
    if (severity === "critical") return dashboardAccents.quotes;
    if (severity === "warning") return dashboardAccents.patchNotes;
    return dashboardAccents.settings;
}

function getCapabilitySeverityIcon(severity: ServerCapabilitySeverity): React.ReactNode {
    if (severity === "critical") return <ErrorOutlined fontSize="small" />;
    if (severity === "warning") return <WarningAmber fontSize="small" />;
    return <CheckCircle fontSize="small" />;
}

function getModuleStateAccent(state: ServerModuleState): string {
    if (state === "active") return dashboardAccents.settings;
    if (state === "partial") return dashboardAccents.patchNotes;
    if (state === "disabled") return dashboardAccents.quotes;
    return dashboardAccents.neutral;
}

function getModuleStateIcon(state: ServerModuleState): React.ReactNode {
    if (state === "active") return <CheckCircle fontSize="small" />;
    if (state === "partial") return <WarningAmber fontSize="small" />;
    if (state === "disabled") return <PowerSettingsNew fontSize="small" />;
    return <InfoOutlined fontSize="small" />;
}

function getProviderStateAccent(state: ServerProviderState): string {
    if (state === "active") return dashboardAccents.settings;
    if (state === "warning") return dashboardAccents.patchNotes;
    if (state === "critical") return dashboardAccents.quotes;
    if (state === "paused") return dashboardAccents.neutral;
    return dashboardAccents.neutral;
}

function getProviderStateIcon(state: ServerProviderState): React.ReactNode {
    if (state === "active") return <CheckCircle fontSize="small" />;
    if (state === "warning") return <WarningAmber fontSize="small" />;
    if (state === "critical") return <ErrorOutlined fontSize="small" />;
    if (state === "paused") return <PowerSettingsNew fontSize="small" />;
    return <InfoOutlined fontSize="small" />;
}

function getProviderStateLabel(state: ServerProviderState): string {
    if (state === "active") return "Active";
    if (state === "warning") return "Warning";
    if (state === "critical") return "Critical";
    if (state === "paused") return "Paused";
    return "Not configured";
}

function toProviderConfig(
    providerKey: string,
    providerLabel: string,
    moduleName: string,
    configs: readonly unknown[],
    href: string
): ServerProviderConfigInput {
    return {
        providerKey,
        providerLabel,
        moduleName,
        configured: configs.length,
        paused: countPaused(configs),
        missingChannels: countMissingChannels(configs),
        href,
    };
}

function countPaused(configs: readonly unknown[]): number {
    return configs.filter((config) => Boolean((config as { paused?: unknown }).paused)).length;
}

function countMissingChannels(configs: readonly unknown[]): number {
    return configs.filter((config) => {
        const record = config as { channelId?: unknown; discordChannelId?: unknown; targetType?: unknown };
        if (record.targetType === "dm") return false;
        const channelId = record.discordChannelId ?? record.channelId;
        if (typeof channelId === "string") return channelId.trim().length === 0;
        return channelId === null || channelId === undefined;
    }).length;
}

function asReviewRecords(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}
