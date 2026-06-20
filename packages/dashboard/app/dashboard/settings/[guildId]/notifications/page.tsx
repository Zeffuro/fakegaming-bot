"use client";
import React from "react";
import Link from "next/link";
import { Box, Button } from "@mui/material";
import { AlternateEmail, AutoStories, Cake, LiveTv, NotificationsActive, SpeakerNotes, YouTube as YouTubeIcon } from "@mui/icons-material";
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
                            <Button
                                component={Link}
                                href={`/dashboard/settings/${encodedGuildId}`}
                                variant="outlined"
                                sx={ghostActionButtonSx(dashboardAccents.settings)}
                            >
                                Back To Settings
                            </Button>
                        )}
                    />

                    <FeaturePanel accent={dashboardAccents.settings}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                            {cards.map((card) => (
                                <FeatureCard key={card.title} {...card} statusLabel="active" />
                            ))}
                        </Box>
                    </FeaturePanel>
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}
