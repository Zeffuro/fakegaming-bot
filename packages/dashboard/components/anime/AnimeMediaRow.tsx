"use client";

import React from "react";
import { Avatar, Box, Chip, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import { ANIME_ACCENT_SOFT, ANIME_GOLD, ANIME_PINK } from "@/components/anime/animeTheme";
import { canSubscribe, formatAnimeMeta, formatAnimeTitle, formatNextEpisode, formatStatus } from "@/components/anime/animeUtils";
import type { AnimeSearchResult } from "@/lib/api-client";

interface AnimeMediaRowProps {
  anime: AnimeSearchResult;
  actions?: React.ReactNode;
  dense?: boolean;
  showGenres?: boolean;
  sx?: SxProps<Theme>;
}

export function AnimeMediaRow({ anime, actions, dense = false, showGenres = false, sx }: AnimeMediaRowProps) {
  const nextEpisode = formatNextEpisode(anime);
  const posterWidth = dense ? 42 : 64;
  const posterHeight = dense ? 58 : 90;

  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", minWidth: 0, ...sx }}>
      <Avatar
        src={anime.coverImage?.large ?? undefined}
        variant="rounded"
        sx={{
          width: posterWidth,
          height: posterHeight,
          flex: "0 0 auto",
          borderRadius: 2,
          bgcolor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      />
      <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant={dense ? "body2" : "subtitle1"}
          sx={{ color: "grey.50", fontWeight: 800, lineHeight: 1.2 }}
          noWrap={dense}
        >
          {formatAnimeTitle(anime)}
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.58)" }}>
          {formatAnimeMeta(anime)}
        </Typography>
        {!dense && (
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, minWidth: 0 }}>
            <Chip
              size="small"
              label={formatStatus(anime.status)}
              sx={{
                bgcolor: canSubscribe(anime) ? "rgba(104,215,255,0.12)" : "rgba(255,107,154,0.12)",
                color: canSubscribe(anime) ? ANIME_ACCENT_SOFT : ANIME_PINK,
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            />
            {nextEpisode && (
              <Chip
                size="small"
                label={nextEpisode}
                sx={{
                  maxWidth: "100%",
                  height: "auto",
                  minHeight: 24,
                  bgcolor: "rgba(255,200,87,0.12)",
                  color: ANIME_GOLD,
                  border: "1px solid rgba(255,255,255,0.10)",
                  "& .MuiChip-label": {
                    py: 0.25,
                    overflow: "visible",
                    textOverflow: "clip",
                    whiteSpace: "normal",
                  },
                }}
              />
            )}
            {showGenres && anime.genres?.slice(0, 3).map((genre) => (
              <Chip
                key={genre}
                size="small"
                label={genre}
                sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.70)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            ))}
          </Stack>
        )}
      </Stack>
      {actions && (
        <Box sx={{ flex: { xs: "1 0 100%", sm: "0 0 auto" }, alignSelf: dense ? "center" : "flex-start" }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
