"use client";

import React from "react";
import Link from "next/link";
import { AlternateEmail, AutoStories, Cake, LiveTv, SpeakerNotes, YouTube as YouTubeIcon } from "@mui/icons-material";
import { Button, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";

export type FeatureNavModule = "Twitch" | "TikTok" | "Bluesky" | "YouTube" | "Patch Notes" | "Anime" | "Birthdays";

const modules: Array<{ label: FeatureNavModule; href: string; accent: string; icon: React.ReactNode }> = [
  { label: "Twitch", href: "twitch", accent: dashboardAccents.twitch, icon: <LiveTv fontSize="small" /> },
  { label: "TikTok", href: "tiktok", accent: dashboardAccents.tiktok, icon: <LiveTv fontSize="small" /> },
  { label: "Bluesky", href: "bluesky", accent: dashboardAccents.bluesky, icon: <AlternateEmail fontSize="small" /> },
  { label: "YouTube", href: "youtube", accent: dashboardAccents.youtube, icon: <YouTubeIcon fontSize="small" /> },
  { label: "Patch Notes", href: "patch-notes", accent: dashboardAccents.patchNotes, icon: <SpeakerNotes fontSize="small" /> },
  { label: "Anime", href: "anime", accent: dashboardAccents.anime, icon: <AutoStories fontSize="small" /> },
  { label: "Birthdays", href: "birthdays", accent: dashboardAccents.birthdays, icon: <Cake fontSize="small" /> },
];

interface FeatureNavProps {
  guildId: string;
  activeModule: FeatureNavModule;
}

export function FeatureNav({ guildId, activeModule }: FeatureNavProps) {
  const encodedGuildId = encodeURIComponent(guildId);

  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: "flex-start", lg: "flex-end" }, flexWrap: "wrap", rowGap: 1 }}>
      {modules.map((module) => {
        const active = module.label === activeModule;
        return (
          <Button
            key={module.label}
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
            {module.label}
          </Button>
        );
      })}
    </Stack>
  );
}
