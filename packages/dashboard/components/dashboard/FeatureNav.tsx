"use client";

import React from "react";
import Link from "next/link";
import { AlternateEmail, AutoStories, Cake, LiveTv, SpeakerNotes, SportsEsports, YouTube as YouTubeIcon } from "@mui/icons-material";
import { Button, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { DashboardMessageKey } from "@/lib/i18n/messages";

export type FeatureNavModule = "Twitch" | "TikTok" | "Bluesky" | "YouTube" | "Steam News" | "Patch Notes" | "Anime" | "Birthdays";

const modules: Array<{ id: FeatureNavModule; labelKey: DashboardMessageKey; href: string; accent: string; icon: React.ReactNode }> = [
  { id: "Twitch", labelKey: "featureNav.twitch", href: "twitch", accent: dashboardAccents.twitch, icon: <LiveTv fontSize="small" /> },
  { id: "TikTok", labelKey: "featureNav.tiktok", href: "tiktok", accent: dashboardAccents.tiktok, icon: <LiveTv fontSize="small" /> },
  { id: "Bluesky", labelKey: "featureNav.bluesky", href: "bluesky", accent: dashboardAccents.bluesky, icon: <AlternateEmail fontSize="small" /> },
  { id: "YouTube", labelKey: "featureNav.youtube", href: "youtube", accent: dashboardAccents.youtube, icon: <YouTubeIcon fontSize="small" /> },
  { id: "Steam News", labelKey: "featureNav.steamNews", href: "steam-news", accent: dashboardAccents.steam, icon: <SportsEsports fontSize="small" /> },
  { id: "Patch Notes", labelKey: "featureNav.patchNotes", href: "patch-notes", accent: dashboardAccents.patchNotes, icon: <SpeakerNotes fontSize="small" /> },
  { id: "Anime", labelKey: "featureNav.anime", href: "anime", accent: dashboardAccents.anime, icon: <AutoStories fontSize="small" /> },
  { id: "Birthdays", labelKey: "featureNav.birthdays", href: "birthdays", accent: dashboardAccents.birthdays, icon: <Cake fontSize="small" /> },
];

interface FeatureNavProps {
  guildId: string;
  activeModule: FeatureNavModule;
}

export function FeatureNav({ guildId, activeModule }: FeatureNavProps) {
  const encodedGuildId = encodeURIComponent(guildId);
  const { t } = useDashboardI18n();

  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: "flex-start", lg: "flex-end" }, flexWrap: "wrap", rowGap: 1 }}>
      {modules.map((module) => {
        const active = module.id === activeModule;
        return (
          <Button
            key={module.id}
            component={Link}
            href={`/dashboard/${module.href}/${encodedGuildId}`}
            size="small"
            startIcon={module.icon}
            variant={active ? "contained" : "outlined"}
            sx={active ? {
              ...ghostActionButtonSx(module.accent),
              color: "grey.50",
              borderColor: "transparent",
              bgcolor: alpha(module.accent, 0.82),
              "&:hover": { bgcolor: module.accent },
            } : ghostActionButtonSx(module.accent)}
          >
            {t(module.labelKey)}
          </Button>
        );
      })}
    </Stack>
  );
}
