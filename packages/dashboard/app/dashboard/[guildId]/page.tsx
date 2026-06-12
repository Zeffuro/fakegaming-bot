"use client";
import React from "react";
import { Alert, Box, Typography } from "@mui/material";
import { AlternateEmail, AutoStories, Block, Cake, FormatQuote, LiveTv, NotificationsActive, Settings, SpeakerNotes, Timeline, YouTube } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { useGuildDashboardSummary } from "@/components/hooks/useGuildDashboardSummary";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import type { GuildDashboardSummaryCounts } from "@/lib/api-client";

const emptySummaryCounts: GuildDashboardSummaryCounts = {
  twitch: 0,
  tiktok: 0,
  bluesky: 0,
  youtube: 0,
  patchSubscriptions: 0,
  anime: 0,
  birthdays: 0,
};

export default function GuildDashboard() {
  const { guildId, guild, guildsLoading } = useGuildFromParams();
  const encodedGuildId = encodeURIComponent(guildId);
  const guildReady = Boolean(guild);

  const summaryApi = useGuildDashboardSummary(guildId, { enabled: guildReady });
  const counts = summaryApi.summary?.counts ?? emptySummaryCounts;
  const notificationLoading = summaryApi.loading;
  const totalConfigured = summaryApi.summary?.totalConfigured ?? 0;

  if (!guild && !guildsLoading) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>
          Guild not found or you don't have access to this guild.
        </Alert>
      </DashboardLayout>
    );
  }

  const modules = [
    {
      title: "Notifications Hub",
      description: "Central command center for Twitch, TikTok, Bluesky, YouTube, Patch Notes, Anime, and Birthday notifications.",
      icon: <NotificationsActive />,
      accent: dashboardAccents.settings,
      href: `/dashboard/settings/${encodedGuildId}/notifications`,
      chipLabel: notificationLoading ? "Loading..." : `${totalConfigured} Configured`,
      meta: notificationLoading ? "Loading notification counts" : `Twitch ${counts.twitch} | TikTok ${counts.tiktok} | Bluesky ${counts.bluesky} | YouTube ${counts.youtube} | Patch ${counts.patchSubscriptions} | Anime ${counts.anime} | Birthdays ${counts.birthdays}`,
      actionLabel: "Open Hub",
    },
    {
      title: "Anime Episodes",
      description: "AniList-powered anime search, season browsing, and channel reminders.",
      icon: <AutoStories />,
      accent: dashboardAccents.anime,
      href: `/dashboard/anime/${encodedGuildId}`,
      chipLabel: `${counts.anime} Configured`,
      actionLabel: "Configure Anime",
    },
    {
      title: "Birthday Announcements",
      description: "Member birthday dates with Discord member search and per-birthday destination channels.",
      icon: <Cake />,
      accent: dashboardAccents.birthdays,
      href: `/dashboard/birthdays/${encodedGuildId}`,
      chipLabel: `${counts.birthdays} Configured`,
      actionLabel: "Configure Birthdays",
    },
    {
      title: "Quotes Management",
      description: "View, add, search, and delete quotes stored for your server.",
      icon: <FormatQuote />,
      accent: dashboardAccents.quotes,
      href: `/dashboard/quotes/${encodedGuildId}`,
      actionLabel: "Manage Quotes",
    },
    {
      title: "YouTube Uploads",
      description: "Configure YouTube channels to post notifications when new videos are uploaded.",
      icon: <YouTube />,
      accent: dashboardAccents.youtube,
      href: `/dashboard/youtube/${encodedGuildId}`,
      chipLabel: `${counts.youtube} Configured`,
      actionLabel: "Configure YouTube",
    },
    {
      title: "Twitch Live",
      description: "Configure Twitch stream notifications and live alerts.",
      icon: <LiveTv />,
      accent: dashboardAccents.twitch,
      href: `/dashboard/twitch/${encodedGuildId}`,
      chipLabel: `${counts.twitch} Configured`,
      actionLabel: "Configure Twitch",
    },
    {
      title: "TikTok Live",
      description: "Configure TikTok live notifications and live alerts.",
      icon: <LiveTv />,
      accent: dashboardAccents.tiktok,
      href: `/dashboard/tiktok/${encodedGuildId}`,
      chipLabel: `${counts.tiktok} Configured`,
      actionLabel: "Configure TikTok",
    },
    {
      title: "Bluesky Posts",
      description: "Configure Bluesky account post notifications.",
      icon: <AlternateEmail />,
      accent: dashboardAccents.bluesky,
      href: `/dashboard/bluesky/${encodedGuildId}`,
      chipLabel: `${counts.bluesky} Configured`,
      actionLabel: "Configure Bluesky",
    },
    {
      title: "Server Settings",
      description: "Configure bot behavior, permissions, and general server settings.",
      icon: <Settings />,
      accent: dashboardAccents.settings,
      href: `/dashboard/settings/${encodedGuildId}`,
      actionLabel: "Open Settings",
    },
    {
      title: "Command Management",
      description: "Enable or disable specific bot commands and modules for this server.",
      icon: <Block />,
      accent: dashboardAccents.commands,
      href: `/dashboard/commands/${encodedGuildId}`,
      actionLabel: "Manage Commands",
    },
    {
      title: "Patch Notes",
      description: "Manage game patch note notifications and subscriptions.",
      icon: <SpeakerNotes />,
      accent: dashboardAccents.patchNotes,
      href: `/dashboard/patch-notes/${encodedGuildId}`,
      chipLabel: `${counts.patchSubscriptions} Configured`,
      actionLabel: "Configure Patches",
    },
    {
      title: "Analytics",
      description: "Server activity, member engagement, and bot usage analytics.",
      icon: <Timeline />,
      accent: dashboardAccents.neutral,
      disabled: true,
      statusLabel: "planned",
    },
  ];

  return (
    <DashboardLayout guild={guild} currentModule={null} maxWidth="xl" loading={guildsLoading}>
      {guild && (
        <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.anime}>
          <FeatureHero
            icon={<Settings />}
            eyebrow="Dashboard"
            title={`${guild.name} Dashboard`}
            description="A cleaner control center for the bot features this server can actually use. High-value tools are grouped first; lower-level settings stay available without dominating the page."
            accent={dashboardAccents.settings}
            secondaryAccent={dashboardAccents.anime}
            stats={[
              { label: "Members", value: guild.member_count || "N/A" },
              { label: "Configured Notifications", value: notificationLoading ? "..." : totalConfigured },
              { label: "Available Pages", value: modules.filter(module => !module.disabled).length },
            ]}
          />

          <FeaturePanel accent={dashboardAccents.settings} sx={{ mb: 3 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2, position: "relative" }}>
              {[
                { label: "Members", value: guild.member_count || "N/A", color: dashboardAccents.settings },
                { label: "Active Pages", value: modules.filter(module => !module.disabled).length, color: dashboardAccents.commands },
                { label: "Notification Configs", value: notificationLoading ? "..." : totalConfigured, color: dashboardAccents.anime },
                { label: "Coming Soon", value: modules.filter(module => module.disabled).length, color: dashboardAccents.neutral },
              ].map((stat) => (
                <Box key={stat.label} sx={{ textAlign: "center", p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: stat.color }}>{stat.value}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>{stat.label}</Typography>
                </Box>
              ))}
            </Box>
          </FeaturePanel>

          <Typography variant="h5" sx={{ mb: 2, fontWeight: 850, color: "grey.50" }}>
            Available Modules
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {modules.map((module) => (
              <FeatureCard key={module.title} {...module} statusLabel={module.statusLabel ?? "active"} />
            ))}
          </Box>
        </FeatureShell>
      )}
    </DashboardLayout>
  );
}
