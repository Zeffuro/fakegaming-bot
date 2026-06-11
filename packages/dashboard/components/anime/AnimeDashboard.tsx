"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { Alert, Box, Stack } from "@mui/material";
import DashboardLayout from "@/components/DashboardLayout";
import { AnimePageHeader } from "@/components/anime/AnimePageHeader";
import { AnimeSeasonBrowser } from "@/components/anime/AnimeSeasonBrowser";
import { AnimeSetupPanel } from "@/components/anime/AnimeSetupPanel";
import { AnimeSubscriptionsPanel } from "@/components/anime/AnimeSubscriptionsPanel";
import { animeShellSx } from "@/components/anime/animeTheme";
import type { AnimeDashboardChannel } from "@/components/anime/types";
import { useAnimeDashboard } from "@/components/hooks/useAnimeDashboard";
import { useGuildChannels } from "@/components/hooks/useGuildChannels";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import type { AnimeSearchResult } from "@/lib/api-client";

export function AnimeDashboard() {
  const { guildId, guild, guildsLoading } = useGuildFromParams();
  const anime = useAnimeDashboard(guildId);
  const { channels, loading: loadingChannels, getChannelName } = useGuildChannels(guildId);
  const notificationChannelInputRef = useRef<HTMLInputElement | null>(null);

  const selectedChannel = useMemo(
    () => (channels as AnimeDashboardChannel[]).find((channel) => channel.id === anime.channelId) ?? null,
    [anime.channelId, channels],
  );

  const focusNotificationChannel = useCallback(() => {
    window.setTimeout(() => {
      notificationChannelInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      notificationChannelInputRef.current?.focus({ preventScroll: true });
    }, 0);
  }, []);

  const handleSubscribe = useCallback(async (targetAnime?: AnimeSearchResult) => {
    if (!anime.channelId) focusNotificationChannel();
    await anime.addSubscription(targetAnime);
  }, [anime.addSubscription, anime.channelId, focusNotificationChannel]);

  const currentTrail = guild ? [
    { label: "Settings", href: `/dashboard/settings/${encodeURIComponent(guildId)}` },
    { label: "Notifications", href: `/dashboard/settings/${encodeURIComponent(guildId)}/notifications` },
    { label: "Anime", href: null },
  ] : null;

  if (!guild && !guildsLoading) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>
          Guild not found or you do not have access to this guild.
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guild={guild} currentModule="anime" currentTrail={currentTrail} maxWidth="xl" loading={guildsLoading || anime.loading}>
      {guild && (
        <Box sx={animeShellSx}>
          <AnimePageHeader guildId={guildId} serverCount={anime.serverSubs.length} personalCount={anime.personalSubs.length} />

          {anime.error && (
            <Alert
              severity="error"
              sx={{ mb: 3, bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }}
              onClose={() => anime.setError(null)}
            >
              {anime.error}
            </Alert>
          )}

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "420px minmax(0, 1fr)" }, gap: 3, mb: 3 }}>
            <AnimeSetupPanel
              searchInput={anime.searchInput}
              searchMediaType={anime.searchMediaType}
              searchResults={anime.searchResults}
              selectedAnime={anime.selectedAnime}
              searchLoading={anime.searchLoading}
              channels={channels as AnimeDashboardChannel[]}
              selectedChannel={selectedChannel}
              loadingChannels={loadingChannels}
              channelId={anime.channelId}
              reminderMinutes={anime.reminderMinutes}
              saving={anime.saving}
              onSearchInputChange={anime.setSearchInput}
              onSearchMediaTypeChange={anime.setSearchMediaType}
              onSelectedAnimeChange={anime.setSelectedAnime}
              onChannelChange={anime.setChannelId}
              onReminderMinutesChange={anime.setReminderMinutes}
              onSubscribe={handleSubscribe}
              notificationChannelInputRef={notificationChannelInputRef}
            />

            <AnimeSeasonBrowser
              season={anime.season}
              seasonScope={anime.seasonScope}
              seasonYear={anime.seasonYear}
              seasonPage={anime.seasonPage}
              seasonLabel={anime.seasonLabel}
              seasonResults={anime.seasonResults}
              seasonHasNext={anime.seasonHasNext}
              seasonLoading={anime.seasonLoading}
              channelId={anime.channelId}
              saving={anime.saving}
              onSeasonChange={anime.setSeason}
              onSeasonScopeChange={anime.setSeasonScope}
              onSeasonYearChange={anime.setSeasonYear}
              onSeasonPageChange={anime.setSeasonPage}
              onUseAnime={anime.setSelectedAnime}
              onSubscribe={handleSubscribe}
            />
          </Box>

          <Stack spacing={3}>
            <AnimeSubscriptionsPanel
              serverSubs={anime.serverSubs}
              personalSubs={anime.personalSubs}
              saving={anime.saving}
              getChannelName={getChannelName}
              onDelete={anime.deleteSubscription}
            />
          </Stack>
        </Box>
      )}
    </DashboardLayout>
  );
}
