"use client";
import React, { useMemo } from "react";
import Link from "next/link";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { AlternateEmail, AutoStories, Cake, Download, LiveTv, NotificationsActive, Search, SpeakerNotes, YouTube as YouTubeIcon } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useTwitchConfigs } from "@/components/hooks/useTwitch";
import { useYouTubeConfigs } from "@/components/hooks/useYouTube";
import { usePatchSubscriptions } from "@/components/hooks/usePatchSubscriptions";
import { useTikTokConfigs } from "@/components/hooks/useTikTok";
import { useBlueskyConfigs } from "@/components/hooks/useBluesky";
import { useBirthdays } from "@/components/hooks/useBirthdays";
import { useAnimeConfigs } from "@/components/hooks/useAnime";
import { buildNotificationSetupReview, type NotificationSetupReview, type NotificationReviewGroup, type NotificationChannelLoad } from "@/lib/notificationSetupReview";
import { buildNotificationSetupExport, buildNotificationSetupExportFilename } from "@/lib/notificationSetupExport";
import { buildNotificationChannelLinks, buildNotificationReviewGroupLink, type NotificationSetupLink } from "@/lib/notificationSetupLinks";

export default function GuildNotificationsHubPage() {
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const guildReady = Boolean(guild);
    const twitchApi = useTwitchConfigs(guildId as string);
    const youtubeApi = useYouTubeConfigs(guildId as string);
    const patchApi = usePatchSubscriptions(guildId as string);
    const tiktokApi = useTikTokConfigs(guildId as string);
    const blueskyApi = useBlueskyConfigs(guildId as string);
    const birthdayApi = useBirthdays(guildId as string, { enabled: guildReady });
    const animeApi = useAnimeConfigs(guildId as string, { enabled: guildReady });

    const loading = guildsLoading || twitchApi.loading || youtubeApi.loading || patchApi.loading || tiktokApi.loading || blueskyApi.loading || birthdayApi.loading || animeApi.loading;
    const totalConfigured = twitchApi.configs.length + tiktokApi.configs.length + blueskyApi.configs.length + youtubeApi.configs.length + patchApi.configs.length + animeApi.configs.length + birthdayApi.birthdays.length;
    const encodedGuildId = encodeURIComponent(guildId as string);
    const notificationRecords = useMemo(() => ({
        twitch: asReviewRecords(twitchApi.configs),
        youtube: asReviewRecords(youtubeApi.configs),
        tiktok: asReviewRecords(tiktokApi.configs),
        bluesky: asReviewRecords(blueskyApi.configs),
        patchNotes: asReviewRecords(patchApi.configs),
        anime: asReviewRecords(animeApi.configs),
        birthdays: asReviewRecords(birthdayApi.birthdays),
    }), [
        twitchApi.configs,
        youtubeApi.configs,
        tiktokApi.configs,
        blueskyApi.configs,
        patchApi.configs,
        animeApi.configs,
        birthdayApi.birthdays,
    ]);
    const setupReview = useMemo(() => buildNotificationSetupReview({
        ...notificationRecords,
    }), [notificationRecords]);

    const handleExportSetup = () => {
        const exported = buildNotificationSetupExport({
            guildId: guildId as string,
            review: setupReview,
            ...notificationRecords,
        });
        downloadJson(buildNotificationSetupExportFilename(guildId as string), exported);
    };

    if (!guild && !guildsLoading) {
        return <GuildAccessError />;
    }

    const cards = [
        {
            title: "Twitch Live",
            description: "Stream alerts with destination channels, custom messages, cooldowns, and quiet hours.",
            icon: <LiveTv />,
            accent: dashboardAccents.twitch,
            href: `/dashboard/twitch/${encodedGuildId}`,
            chipLabel: `${twitchApi.configs.length} Configured`,
            actionLabel: "Manage Twitch",
        },
        {
            title: "TikTok Live",
            description: "Creator live alerts using the same channel routing and notification controls as Twitch.",
            icon: <LiveTv />,
            accent: dashboardAccents.tiktok,
            href: `/dashboard/tiktok/${encodedGuildId}`,
            chipLabel: `${tiktokApi.configs.length} Configured`,
            actionLabel: "Manage TikTok",
        },
        {
            title: "Bluesky Posts",
            description: "Account post alerts with Discord channel routing, custom messages, cooldowns, and quiet hours.",
            icon: <AlternateEmail />,
            accent: dashboardAccents.bluesky,
            href: `/dashboard/bluesky/${encodedGuildId}`,
            chipLabel: `${blueskyApi.configs.length} Configured`,
            actionLabel: "Manage Bluesky",
        },
        {
            title: "YouTube Uploads",
            description: "Watch channels for new uploads and post clean video announcements to Discord.",
            icon: <YouTubeIcon />,
            accent: dashboardAccents.youtube,
            href: `/dashboard/youtube/${encodedGuildId}`,
            chipLabel: `${youtubeApi.configs.length} Configured`,
            actionLabel: "Manage YouTube",
        },
        {
            title: "Patch Notes",
            description: "Subscribe channels to game update feeds so patch posts land where people expect them.",
            icon: <SpeakerNotes />,
            accent: dashboardAccents.patchNotes,
            href: `/dashboard/patch-notes/${encodedGuildId}`,
            chipLabel: `${patchApi.configs.length} Configured`,
            actionLabel: "Manage Patch Notes",
        },
        {
            title: "Anime Episodes",
            description: "AniList search, season browsing, and channel reminders for upcoming episodes.",
            icon: <AutoStories />,
            accent: dashboardAccents.anime,
            href: `/dashboard/anime/${encodedGuildId}`,
            chipLabel: `${animeApi.configs.length} Configured`,
            actionLabel: "Manage Anime",
        },
        {
            title: "Birthday Announcements",
            description: "Member birthday announcements with member search and per-birthday destination channels.",
            icon: <Cake />,
            accent: dashboardAccents.birthdays,
            href: `/dashboard/birthdays/${encodedGuildId}`,
            chipLabel: `${birthdayApi.birthdays.length} Configured`,
            actionLabel: "Manage Birthdays",
        },
    ];

    return (
        <DashboardLayout guild={guild} currentModule="settings" maxWidth="xl" loading={loading}>
            {!loading && guild && (
                <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.anime}>
                    <FeatureHero
                        icon={<NotificationsActive />}
                        eyebrow="Notifications"
                        title="Notification Command Center"
                        description="One place to manage every server-facing notification feed: live streams, uploads, patch notes, anime episodes, and birthday announcements."
                        accent={dashboardAccents.settings}
                        secondaryAccent={dashboardAccents.anime}
                        stats={[{ label: "Configured Feeds", value: totalConfigured }]}
                        actions={(
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<Download />}
                                    onClick={handleExportSetup}
                                    disabled={totalConfigured === 0}
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    Export JSON
                                </Button>
                                <Button
                                    component={Link}
                                    href={`/dashboard/settings/${encodedGuildId}`}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    Back To Settings
                                </Button>
                            </Stack>
                        )}
                    />

                    <FeaturePanel accent={dashboardAccents.settings}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                            {cards.map((card) => (
                                <FeatureCard key={card.title} {...card} statusLabel="active" />
                            ))}
                        </Box>
                    </FeaturePanel>

                    <SetupReviewPanel review={setupReview} guildId={guildId as string} />
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}

function SetupReviewPanel({ review, guildId }: { review: NotificationSetupReview; guildId: string }) {
    const totalFindings = review.duplicateRoutes.length + review.multiChannelFeeds.length + review.busyChannels.length;

    return (
        <FeaturePanel accent={dashboardAccents.settings} sx={{ mt: 3 }}>
            <Stack spacing={2}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                            Setup Review
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                            Duplicate routes, cross-channel feed overlap, and high-volume notification channels.
                        </Typography>
                    </Box>
                    <Chip
                        label={totalFindings === 0 ? "No findings" : `${totalFindings} ${totalFindings === 1 ? "finding" : "findings"}`}
                        color={totalFindings === 0 ? "success" : "warning"}
                        variant="outlined"
                    />
                </Box>

                {totalFindings === 0 ? (
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                        No duplicate notification routes or crowded destination channels were detected.
                    </Typography>
                ) : (
                    <Stack spacing={1.5}>
                        <ReviewGroupSection title="Duplicate Routes" groups={review.duplicateRoutes} guildId={guildId} />
                        <ReviewGroupSection title="Same Feed, Multiple Channels" groups={review.multiChannelFeeds} guildId={guildId} />
                        <BusyChannelSection channels={review.busyChannels} guildId={guildId} />
                    </Stack>
                )}
            </Stack>
        </FeaturePanel>
    );
}

function ReviewGroupSection({ title, groups, guildId }: { title: string; groups: NotificationReviewGroup[]; guildId: string }) {
    if (groups.length === 0) return null;

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                {title}
            </Typography>
            <Stack spacing={0.75}>
                {groups.slice(0, 5).map((group) => (
                    <ReviewLine
                        key={group.key}
                        primary={`${group.provider}: ${group.sourceLabel}`}
                        secondary={`${group.records.length} routes across ${group.channelIds.length} ${group.channelIds.length === 1 ? "channel" : "channels"}: ${group.channelIds.join(", ")}`}
                        actions={toReviewActions(buildNotificationReviewGroupLink(guildId, group))}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function BusyChannelSection({ channels, guildId }: { channels: NotificationChannelLoad[]; guildId: string }) {
    if (channels.length === 0) return null;

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                Busy Channels
            </Typography>
            <Stack spacing={0.75}>
                {channels.slice(0, 5).map((channel) => (
                    <ReviewLine
                        key={channel.channelId}
                        primary={channel.channelId}
                        secondary={`${channel.count} feeds from ${channel.providers.join(", ")}`}
                        actions={toReviewActions(buildNotificationChannelLinks(guildId, channel))}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function ReviewLine({ primary, secondary, actions }: { primary: string; secondary: string; actions?: React.ReactNode }) {
    return (
        <Box sx={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 1.5, px: 1.25, py: 1, bgcolor: "rgba(255,255,255,0.035)" }}>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750 }}>
                {primary}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
                {secondary}
            </Typography>
            {actions && (
                <Box sx={{ mt: 0.75 }}>
                    {actions}
                </Box>
            )}
        </Box>
    );
}

function toReviewActions(links: NotificationSetupLink | NotificationSetupLink[] | null): React.ReactNode {
    if (!links) return undefined;
    const normalizedLinks = Array.isArray(links) ? links : [links];
    if (normalizedLinks.length === 0) return undefined;

    return (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
            {normalizedLinks.map((link) => (
                <Button
                    key={link.href}
                    component={Link}
                    href={link.href}
                    size="small"
                    startIcon={<Search fontSize="small" />}
                    sx={{
                        color: dashboardAccents.settings,
                        fontWeight: 800,
                        minWidth: 0,
                        px: 0.75,
                        py: 0.25,
                        textTransform: "none",
                    }}
                >
                    {link.label}
                </Button>
            ))}
        </Stack>
    );
}

function asReviewRecords(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

function downloadJson(filename: string, value: unknown): void {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}
