"use client";

import React from "react";
import Link from "next/link";
import { AutoStories } from "@mui/icons-material";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { ANIME_ACCENT, ANIME_ACCENT_SOFT, ANIME_GOLD, ANIME_PINK, ghostButtonSx, panelSx } from "@/components/anime/animeTheme";
import { FeatureNav } from "@/components/dashboard/FeatureNav";

interface AnimePageHeaderProps {
  guildId: string;
  serverCount: number;
  personalCount: number;
}

export function AnimePageHeader({ guildId, serverCount, personalCount }: AnimePageHeaderProps) {
  const encodedGuildId = encodeURIComponent(guildId);

  return (
    <Box
      sx={{
        ...panelSx,
        p: { xs: 2.5, md: 3.5 },
        mb: 3,
        background:
          "linear-gradient(135deg, rgba(2,169,255,0.22), rgba(18,24,34,0.96) 42%, rgba(255,107,154,0.16))",
      }}
    >
      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} sx={{ justifyContent: "space-between", position: "relative" }}>
        <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Chip
              icon={<AutoStories />}
              label="Anime"
              sx={{ bgcolor: "rgba(104,215,255,0.14)", color: ANIME_ACCENT_SOFT, border: `1px solid ${ANIME_ACCENT}` }}
            />
            <Chip label={`${serverCount} Server Subs`} sx={{ bgcolor: "rgba(255,255,255,0.07)", color: "grey.100" }} />
            <Chip label={`${personalCount} DM Subs`} sx={{ bgcolor: "rgba(255,200,87,0.12)", color: ANIME_GOLD }} />
          </Stack>
          <Typography variant="h3" sx={{ color: "grey.50", fontWeight: 900, letterSpacing: "-0.04em" }}>
            Anime Episodes
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: { xs: 15, md: 17 }, maxWidth: 680 }}>
            Search exact AniList entries, browse seasonal charts with sensible filters, and subscribe a guild channel to upcoming episode reminders.
          </Typography>
        </Stack>

        <Stack spacing={1.5} sx={{ alignItems: { xs: "stretch", lg: "flex-end" }, minWidth: { lg: 360 } }}>
          <Button
            component={Link}
            href={`/dashboard/settings/${encodedGuildId}/notifications`}
            variant="outlined"
            sx={{ ...ghostButtonSx, borderColor: "rgba(255,255,255,0.22)" }}
          >
            Back To Notifications
          </Button>
          <FeatureNav guildId={guildId} activeModule="Anime" />
        </Stack>
      </Stack>
      <Box
        sx={{
          position: "absolute",
          right: -64,
          bottom: -86,
          width: 220,
          height: 220,
          borderRadius: "999px",
          background: `radial-gradient(circle, ${ANIME_PINK}33, transparent 66%)`,
          pointerEvents: "none",
        }}
      />
    </Box>
  );
}
