"use client";

import React from "react";
import { AutoStories, NavigateBefore, NavigateNext } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { AnimeMediaRow } from "@/components/anime/AnimeMediaRow";
import { AnimeSubscribeButton } from "@/components/anime/AnimeSubscribeButton";
import {
  ANIME_ACCENT_SOFT,
  SEASON_OPTIONS,
  SEASON_SCOPES,
  elevatedPanelSx,
  fieldSx,
  ghostButtonSx,
  type AnimeSeasonOption,
  type AnimeSeasonScope,
} from "@/components/anime/animeTheme";
import { formatAnimeTitle } from "@/components/anime/animeUtils";
import type { AnimeSearchResult } from "@/lib/api-client";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface AnimeSeasonBrowserProps {
  season: AnimeSeasonOption;
  seasonScope: AnimeSeasonScope;
  seasonYear: number;
  seasonPage: number;
  seasonLabel: string;
  seasonResults: AnimeSearchResult[];
  seasonHasNext: boolean;
  seasonLoading: boolean;
  channelId: string;
  saving: boolean;
  onSeasonChange: (value: AnimeSeasonOption) => void;
  onSeasonScopeChange: (value: AnimeSeasonScope) => void;
  onSeasonYearChange: (value: number) => void;
  onSeasonPageChange: (updater: number | ((page: number) => number)) => void;
  onUseAnime: (anime: AnimeSearchResult | null) => void;
  onSubscribe: (anime: AnimeSearchResult) => void | Promise<void>;
}

function formatSeasonOption(option: AnimeSeasonOption, t: ReturnType<typeof useDashboardI18n>["t"]): string {
  if (option === "current") return t("anime.seasonCurrent");
  if (option === "next") return t("anime.seasonNext");
  if (option === "WINTER") return t("anime.seasonWinter");
  if (option === "SPRING") return t("anime.seasonSpring");
  if (option === "SUMMER") return t("anime.seasonSummer");
  return t("anime.seasonFall");
}

function formatScopeOption(option: AnimeSeasonScope, t: ReturnType<typeof useDashboardI18n>["t"]): { label: string; description: string } {
  if (option === "airing") return { label: t("anime.scopeAiring"), description: t("anime.scopeAiringDescription") };
  if (option === "chart") return { label: t("anime.scopeChart"), description: t("anime.scopeChartDescription") };
  if (option === "tv") return { label: t("anime.scopeTv"), description: t("anime.scopeTvDescription") };
  return { label: t("anime.scopeAll"), description: t("anime.scopeAllDescription") };
}

export function AnimeSeasonBrowser({
  season,
  seasonScope,
  seasonYear,
  seasonPage,
  seasonLabel,
  seasonResults,
  seasonHasNext,
  seasonLoading,
  channelId,
  saving,
  onSeasonChange,
  onSeasonScopeChange,
  onSeasonYearChange,
  onSeasonPageChange,
  onUseAnime,
  onSubscribe,
}: AnimeSeasonBrowserProps) {
  const { t } = useDashboardI18n();
  return (
    <Paper sx={{ ...elevatedPanelSx, p: 3 }}>
      <Stack spacing={2.5} sx={{ position: "relative" }}>
        <Stack direction={{ xs: "column", xl: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { xl: "flex-start" } }}>
          <Stack spacing={0.5}>
            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, display: "flex", gap: 1, alignItems: "center" }}>
              <AutoStories fontSize="small" />
              {t("anime.browseSeason")}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
              {t("anime.seasonBrowserDescription", { season: seasonLabel })}
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ minWidth: { xl: 520 } }}>
            <TextField
              select
              size="small"
              label={t("anime.season")}
              value={season}
              onChange={(event) => onSeasonChange(event.target.value as AnimeSeasonOption)}
              sx={{ ...fieldSx, minWidth: 136 }}
            >
              {SEASON_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {formatSeasonOption(option, t)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t("anime.scope")}
              value={seasonScope}
              onChange={(event) => onSeasonScopeChange(event.target.value as AnimeSeasonScope)}
              sx={{ ...fieldSx, minWidth: 190 }}
            >
              {SEASON_SCOPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {formatScopeOption(option.value, t).label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="number"
              label={t("anime.year")}
              value={seasonYear}
              disabled={season === "current" || season === "next"}
              onChange={(event) => onSeasonYearChange(Number(event.target.value))}
              sx={{ ...fieldSx, width: { xs: "100%", sm: 112 } }}
            />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {SEASON_SCOPES.map((option) => {
            const copy = formatScopeOption(option.value, t);
            return <Chip
              key={option.value}
              label={`${copy.label}: ${copy.description}`}
              variant={option.value === seasonScope ? "filled" : "outlined"}
              sx={{
                bgcolor: option.value === seasonScope ? "rgba(104,215,255,0.14)" : "transparent",
                color: option.value === seasonScope ? ANIME_ACCENT_SOFT : "rgba(255,255,255,0.62)",
                borderColor: "rgba(255,255,255,0.14)",
              }}
            />;
          })}
        </Stack>

        {seasonLoading ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", color: "rgba(255,255,255,0.64)" }}>
            <CircularProgress size={22} />
            <Typography variant="body2">{t("anime.loadingResults")}</Typography>
          </Stack>
        ) : seasonResults.length === 0 ? (
          <Box sx={{ p: 3, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", color: "rgba(255,255,255,0.62)" }}>
            {t("anime.noSeasonResults")}
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
            {seasonResults.map((anime) => (
              <Card key={anime.id} sx={{ bgcolor: "rgba(8,13,22,0.72)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3 }}>
                <CardContent>
                  <AnimeMediaRow
                    anime={anime}
                    showGenres
                    actions={(
                      <Stack spacing={1} sx={{ width: { xs: "100%", sm: 132 }, minWidth: 132 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          onClick={() => onUseAnime(anime)}
                          sx={ghostButtonSx}
                          title={t("anime.useInSearch", { title: formatAnimeTitle(anime) })}
                        >
                          {t("anime.use")}
                        </Button>
                        <AnimeSubscribeButton anime={anime} channelId={channelId} saving={saving} onSubscribe={onSubscribe} fullWidth />
                      </Stack>
                    )}
                  />
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
          <Button
            startIcon={<NavigateBefore />}
            disabled={seasonPage <= 1 || seasonLoading}
            onClick={() => onSeasonPageChange((page) => Math.max(1, page - 1))}
            sx={ghostButtonSx}
          >
            {t("anime.previous")}
          </Button>
          <Chip label={t("anime.page", { page: seasonPage })} variant="outlined" sx={{ color: "grey.100", borderColor: "rgba(255,255,255,0.16)" }} />
          <Button
            endIcon={<NavigateNext />}
            disabled={!seasonHasNext || seasonLoading}
            onClick={() => onSeasonPageChange((page) => page + 1)}
            sx={ghostButtonSx}
          >
            {t("anime.next")}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
