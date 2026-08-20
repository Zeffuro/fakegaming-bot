"use client";
import React from "react";
import { Box, Typography } from "@mui/material";
import { AlternateEmail, AutoStories, Block, Cake, FormatQuote, LiveTv, NotificationsActive, Settings, SpeakerNotes, SportsEsports, Timeline, YouTube } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { useGuildDashboardSummary } from "@/components/hooks/useGuildDashboardSummary";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { GuildDashboardSummaryCounts } from "@/lib/api-client";

interface GuildDashboardModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  href?: string;
  chipLabel?: string;
  statusLabel?: string;
  meta?: React.ReactNode;
  actionLabel?: string;
}

const emptySummaryCounts: GuildDashboardSummaryCounts = {
  twitch: 0,
  tiktok: 0,
  bluesky: 0,
  youtube: 0,
  steamNews: 0,
  patchSubscriptions: 0,
  anime: 0,
  birthdays: 0,
};

export default function GuildDashboard() {
  const { t, formatNumber } = useDashboardI18n();
  const { guildId, guild, guildsLoading } = useGuildFromParams();
  const encodedGuildId = encodeURIComponent(guildId);
  const guildReady = Boolean(guild);
  const memberCount = typeof guild?.member_count === "number"
    ? formatNumber(guild.member_count)
    : t("guildDashboard.notAvailable");

  const summaryApi = useGuildDashboardSummary(guildId, { enabled: guildReady });
  const counts = summaryApi.summary?.counts ?? emptySummaryCounts;
  const notificationLoading = summaryApi.loading;
  const totalConfigured = summaryApi.summary?.totalConfigured ?? 0;
  const configuredNotificationTypes = Object.values(counts).filter(count => count > 0).length;

  if (!guild && !guildsLoading) {
    return <GuildAccessError />;
  }

  const modules: GuildDashboardModule[] = [
    {
      title: t("guildDashboard.notificationsHub"),
      description: t("guildDashboard.notificationsHubDescription"),
      icon: <NotificationsActive />,
      accent: dashboardAccents.settings,
      href: `/dashboard/settings/${encodedGuildId}/notifications`,
      chipLabel: notificationLoading ? t("common.loading") : t("guildDashboard.configured", { count: totalConfigured }),
      meta: notificationLoading ? t("guildDashboard.loadingCounts") : t("guildDashboard.providerCounts", { twitch: counts.twitch, tiktok: counts.tiktok, bluesky: counts.bluesky, youtube: counts.youtube, steam: counts.steamNews, patch: counts.patchSubscriptions, anime: counts.anime, birthdays: counts.birthdays }),
      actionLabel: t("guildDashboard.openHub"),
    },
    {
      title: t("guildDashboard.animeTitle"),
      description: t("guildDashboard.animeDescription"),
      icon: <AutoStories />,
      accent: dashboardAccents.anime,
      href: `/dashboard/anime/${encodedGuildId}`,
      chipLabel: t("guildDashboard.configured", { count: counts.anime }),
      actionLabel: t("guildDashboard.configureAnime"),
    },
    {
      title: t("guildDashboard.birthdaysTitle"),
      description: t("guildDashboard.birthdaysDescription"),
      icon: <Cake />,
      accent: dashboardAccents.birthdays,
      href: `/dashboard/birthdays/${encodedGuildId}`,
      chipLabel: t("guildDashboard.configured", { count: counts.birthdays }),
      actionLabel: t("guildDashboard.configureBirthdays"),
    },
    {
      title: t("guildDashboard.quotesTitle"),
      description: t("guildDashboard.quotesDescription"),
      icon: <FormatQuote />,
      accent: dashboardAccents.quotes,
      href: `/dashboard/quotes/${encodedGuildId}`,
      actionLabel: t("guildDashboard.manageQuotes"),
    },
    {
      title: t("guildDashboard.youtubeTitle"),
      description: t("guildDashboard.youtubeDescription"),
      icon: <YouTube />,
      accent: dashboardAccents.youtube,
      href: `/dashboard/youtube/${encodedGuildId}`,
      chipLabel: t("guildDashboard.configured", { count: counts.youtube }),
      actionLabel: t("guildDashboard.configureYoutube"),
    },
    {
      title: t("guildDashboard.steamTitle"),
      description: t("guildDashboard.steamDescription"),
      icon: <SportsEsports />,
      accent: dashboardAccents.steam,
      href: `/dashboard/steam-news/${encodedGuildId}`,
      chipLabel: t("guildDashboard.configured", { count: counts.steamNews }),
      actionLabel: t("guildDashboard.configureSteam"),
    },
    {
      title: t("guildDashboard.twitchTitle"),
      description: t("guildDashboard.twitchDescription"),
      icon: <LiveTv />,
      accent: dashboardAccents.twitch,
      href: `/dashboard/twitch/${encodedGuildId}`,
      chipLabel: t("guildDashboard.configured", { count: counts.twitch }),
      actionLabel: t("guildDashboard.configureTwitch"),
    },
    {
      title: t("guildDashboard.tiktokTitle"),
      description: t("guildDashboard.tiktokDescription"),
      icon: <LiveTv />,
      accent: dashboardAccents.tiktok,
      href: `/dashboard/tiktok/${encodedGuildId}`,
      chipLabel: t("guildDashboard.configured", { count: counts.tiktok }),
      actionLabel: t("guildDashboard.configureTiktok"),
    },
    {
      title: t("guildDashboard.blueskyTitle"),
      description: t("guildDashboard.blueskyDescription"),
      icon: <AlternateEmail />,
      accent: dashboardAccents.bluesky,
      href: `/dashboard/bluesky/${encodedGuildId}`,
      chipLabel: t("guildDashboard.configured", { count: counts.bluesky }),
      actionLabel: t("guildDashboard.configureBluesky"),
    },
    {
      title: t("guildDashboard.settingsTitle"),
      description: t("guildDashboard.settingsDescription"),
      icon: <Settings />,
      accent: dashboardAccents.settings,
      href: `/dashboard/settings/${encodedGuildId}`,
      actionLabel: t("guildDashboard.openSettings"),
    },
    {
      title: t("guildDashboard.commandsTitle"),
      description: t("guildDashboard.commandsDescription"),
      icon: <Block />,
      accent: dashboardAccents.commands,
      href: `/dashboard/commands/${encodedGuildId}`,
      actionLabel: t("guildDashboard.manageCommands"),
    },
    {
      title: t("guildDashboard.patchNotesTitle"),
      description: t("guildDashboard.patchNotesDescription"),
      icon: <SpeakerNotes />,
      accent: dashboardAccents.patchNotes,
      href: `/dashboard/patch-notes/${encodedGuildId}`,
      chipLabel: t("guildDashboard.configured", { count: counts.patchSubscriptions }),
      actionLabel: t("guildDashboard.configurePatches"),
    },
    {
      title: t("guildDashboard.analyticsTitle"),
      description: t("guildDashboard.analyticsDescription"),
      icon: <Timeline />,
      accent: dashboardAccents.neutral,
      href: `/dashboard/analytics/${encodedGuildId}`,
      actionLabel: t("guildDashboard.openAnalytics"),
    },
  ];

  return (
    <DashboardLayout guild={guild} currentModule={null} maxWidth="xl" loading={guildsLoading}>
      {guild && (
        <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.anime}>
          <FeatureHero
            icon={<Settings />}
            eyebrow={t("guildDashboard.eyebrow")}
            title={t("guildDashboard.title", { guild: guild.name })}
            description={t("guildDashboard.description")}
            accent={dashboardAccents.settings}
            secondaryAccent={dashboardAccents.anime}
            stats={[
              { label: t("guildDashboard.members"), value: memberCount },
              { label: t("guildDashboard.configuredNotifications"), value: notificationLoading ? "..." : totalConfigured },
              { label: t("guildDashboard.managementPages"), value: modules.length },
            ]}
          />

          <FeaturePanel accent={dashboardAccents.settings} sx={{ mb: 3 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2, position: "relative" }}>
              {[
                { label: t("guildDashboard.members"), value: memberCount, color: dashboardAccents.settings },
                { label: t("guildDashboard.managementPages"), value: modules.length, color: dashboardAccents.commands },
                { label: t("guildDashboard.notificationConfigs"), value: notificationLoading ? "..." : totalConfigured, color: dashboardAccents.anime },
                { label: t("guildDashboard.configuredTypes"), value: notificationLoading ? "..." : configuredNotificationTypes, color: dashboardAccents.neutral },
              ].map((stat) => (
                <Box key={stat.label} sx={{ textAlign: "center", p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: stat.color }}>{stat.value}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>{stat.label}</Typography>
                </Box>
              ))}
            </Box>
          </FeaturePanel>

          <Typography variant="h5" sx={{ mb: 2, fontWeight: 850, color: "grey.50" }}>
            {t("guildDashboard.availableModules")}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {modules.map((module) => (
              <FeatureCard key={module.title} {...module} statusLabel={module.statusLabel ?? t("guildDashboard.active")} />
            ))}
          </Box>
        </FeatureShell>
      )}
    </DashboardLayout>
  );
}
