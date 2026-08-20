"use client";

import React, { useState } from "react";
import { CalendarMonth, ContentCopy, OpenInNew, Refresh } from "@mui/icons-material";
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import { api, type AnimeCalendarLink } from "@/lib/api-client";
import { ANIME_GOLD, elevatedPanelSx, fieldSx, ghostButtonSx, primaryButtonSx } from "@/components/anime/animeTheme";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface AnimeCalendarExportPanelProps {
  personalCount: number;
}

export function AnimeCalendarExportPanel({ personalCount }: AnimeCalendarExportPanelProps) {
  const { t } = useDashboardI18n();
  const [link, setLink] = useState<AnimeCalendarLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLink = async () => {
    try {
      setLoading(true);
      setError(null);
      setCopied(false);
      setLink(await api.getAnimeCalendarLink());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("anime.calendarUnavailable"));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setError(t("anime.clipboardFailed"));
    }
  };

  return (
    <Paper sx={{ ...elevatedPanelSx, p: 3 }}>
      <Stack spacing={2} sx={{ position: "relative" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" } }}>
          <Box>
            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, display: "flex", alignItems: "center", gap: 1 }}>
              <CalendarMonth fontSize="small" />
              {t("anime.calendarExport")}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.5 }}>
              {t("anime.calendarDescription")}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            <Chip label={t("anime.personalCount", { count: personalCount })} sx={{ bgcolor: "rgba(255,200,87,0.12)", color: "grey.50", border: "1px solid rgba(255,200,87,0.24)" }} />
            <Button variant="contained" startIcon={link ? <Refresh /> : <CalendarMonth />} disabled={loading} onClick={loadLink} sx={primaryButtonSx}>
              {link ? t("anime.refreshLink") : t("anime.createLink")}
            </Button>
          </Stack>
        </Stack>

        {error ? (
          <Alert severity="error" sx={{ bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        {link ? (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ alignItems: { md: "center" } }}>
            <TextField
              value={link.url}
              size="small"
              fullWidth
              sx={fieldSx}
              slotProps={{
                input: {
                  readOnly: true,
                },
              }}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Button variant="outlined" startIcon={<ContentCopy />} onClick={copyLink} sx={ghostButtonSx}>
                {copied ? t("common.copied") : t("common.copy")}
              </Button>
              <Button component="a" href={link.url} target="_blank" rel="noreferrer" variant="outlined" startIcon={<OpenInNew />} sx={ghostButtonSx}>
                {t("common.open")}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", color: "rgba(255,255,255,0.58)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Typography variant="body2">
              {t("anime.feedHint")}
            </Typography>
          </Box>
        )}

        <Box sx={{ height: 2, width: 96, borderRadius: 999, bgcolor: ANIME_GOLD, opacity: 0.45 }} />
      </Stack>
    </Paper>
  );
}
