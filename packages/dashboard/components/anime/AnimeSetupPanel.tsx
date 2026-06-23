"use client";

import React from "react";
import { Add, DeleteSweep, History, Refresh, Search } from "@mui/icons-material";
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, Divider, IconButton, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { AnimeMediaRow } from "@/components/anime/AnimeMediaRow";
import { fieldSx, panelSx, primaryButtonSx } from "@/components/anime/animeTheme";
import { canSubscribe, formatAnimeTitle, getSubscribeHint } from "@/components/anime/animeUtils";
import type { AnimeDashboardChannel } from "@/components/anime/types";
import type { AnimeSearchMediaType, AnimeSearchResult } from "@/lib/api-client";
import type { AnimeLookupHistoryEntry } from "@/lib/animeLookupHistory";

interface AnimeSetupPanelProps {
  searchInput: string;
  searchMediaType: AnimeSearchMediaType;
  searchResults: AnimeSearchResult[];
  selectedAnime: AnimeSearchResult | null;
  searchLoading: boolean;
  lookupHistory: AnimeLookupHistoryEntry[];
  channels: AnimeDashboardChannel[];
  selectedChannel: AnimeDashboardChannel | null;
  loadingChannels: boolean;
  channelId: string;
  reminderMinutes: number;
  saving: boolean;
  onSearchInputChange: (value: string) => void;
  onSelectedAnimeChange: (value: AnimeSearchResult | null) => void;
  onUseLookupHistory: (entry: AnimeLookupHistoryEntry) => void;
  onClearLookupHistory: () => void;
  onChannelChange: (value: string) => void;
  onReminderMinutesChange: (value: number) => void;
  onSubscribe: () => void | Promise<void>;
  onRefreshChannels?: () => void | Promise<void>;
  notificationChannelInputRef?: React.RefObject<HTMLInputElement | null>;
  onSearchMediaTypeChange: (value: AnimeSearchMediaType) => void;
}

function subscribeLabel(args: { saving: boolean; selectedAnime: AnimeSearchResult | null; searchInput: string; channelId: string; searchMediaType: AnimeSearchMediaType }) {
  if (args.saving) return "Saving...";
  if (args.searchMediaType === "manga" || args.selectedAnime?.type === "MANGA") return "Lookup Only";
  if (!args.selectedAnime && !args.searchInput.trim()) return "Pick Anime First";
  if (args.selectedAnime && !canSubscribe(args.selectedAnime)) return "Cannot Subscribe";
  if (!args.channelId) return "Choose Channel";
  return "Add Channel Subscription";
}

function historyTypeLabel(mediaType: AnimeSearchMediaType): string {
  return mediaType === "manga" ? "Manga" : "Anime";
}

function LookupHistoryPanel({
  history,
  mediaType,
  onUse,
  onClear,
}: {
  history: AnimeLookupHistoryEntry[];
  mediaType: AnimeSearchMediaType;
  onUse: (entry: AnimeLookupHistoryEntry) => void;
  onClear: () => void;
}) {
  const visibleHistory = history.filter((entry) => entry.mediaType === mediaType).slice(0, 5);

  if (history.length === 0) return null;

  return (
    <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ color: "grey.50", fontWeight: 850, display: "flex", alignItems: "center", gap: 0.75 }}>
            <History fontSize="small" />
            Recent {historyTypeLabel(mediaType)} Lookups
          </Typography>
          <Tooltip title="Clear recent lookups">
            <span>
              <IconButton size="small" aria-label="Clear recent lookups" onClick={onClear} sx={{ color: "rgba(255,255,255,0.62)" }}>
                <DeleteSweep fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {visibleHistory.length === 0 ? (
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)" }}>
            No recent {historyTypeLabel(mediaType).toLowerCase()} lookups.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {visibleHistory.map((entry) => (
              <Box key={`${entry.mediaType}:${entry.id}`} sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750, overflowWrap: "anywhere" }}>
                    {entry.title}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, mt: 0.5 }}>
                    <Chip size="small" label={`AniList #${entry.id}`} variant="outlined" sx={{ color: "rgba(255,255,255,0.62)", borderColor: "rgba(255,255,255,0.14)" }} />
                    <Chip size="small" label={entry.subscribable ? "Subscribable" : "Lookup Only"} sx={{ bgcolor: entry.subscribable ? "rgba(104,215,255,0.12)" : "rgba(255,200,87,0.12)", color: "rgba(255,255,255,0.76)" }} />
                  </Stack>
                </Box>
                <Button size="small" variant="outlined" onClick={() => onUse(entry)} sx={{ textTransform: "none", color: "grey.100", borderColor: "rgba(255,255,255,0.16)", flex: "0 0 auto" }}>
                  Search
                </Button>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export function AnimeSetupPanel({
  searchInput,
  searchMediaType,
  searchResults,
  selectedAnime,
  searchLoading,
  lookupHistory,
  channels,
  selectedChannel,
  loadingChannels,
  channelId,
  reminderMinutes,
  saving,
  onSearchInputChange,
  onSearchMediaTypeChange,
  onSelectedAnimeChange,
  onUseLookupHistory,
  onClearLookupHistory,
  onChannelChange,
  onReminderMinutesChange,
  onSubscribe,
  onRefreshChannels,
  notificationChannelInputRef,
}: AnimeSetupPanelProps) {
  const hasAnimeInput = Boolean(selectedAnime || searchInput.trim());
  const invalidSelectedAnime = Boolean(selectedAnime && !canSubscribe(selectedAnime));
  const mangaLookup = searchMediaType === "manga" || selectedAnime?.type === "MANGA";
  const needsChannel = !channelId && hasAnimeInput && !mangaLookup;
  const subscribeDisabled = saving || !hasAnimeInput || invalidSelectedAnime || mangaLookup;

  return (
    <Paper sx={{ ...panelSx, p: 3 }}>
      <Stack spacing={2.25}>
        <Stack spacing={0.5}>
          <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, display: "flex", gap: 1, alignItems: "center" }}>
            <Search fontSize="small" />
            Search AniList
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
            Anime entries can be subscribed to episode reminders. Manga, manhwa, webtoons, and light novels are lookup-only.
          </Typography>
        </Stack>

        <ToggleButtonGroup
          exclusive
          fullWidth
          value={searchMediaType}
          onChange={(_event, value: AnimeSearchMediaType | null) => {
            if (value) onSearchMediaTypeChange(value);
          }}
          sx={{
            "& .MuiToggleButton-root": {
              color: "rgba(255,255,255,0.72)",
              borderColor: "rgba(255,255,255,0.10)",
              textTransform: "none",
              fontWeight: 800,
              "&.Mui-selected": {
                color: "grey.50",
                bgcolor: "rgba(2,169,255,0.20)",
              },
            },
          }}
        >
          <ToggleButton value="anime">Anime</ToggleButton>
          <ToggleButton value="manga">Manga</ToggleButton>
        </ToggleButtonGroup>

        <Autocomplete
          fullWidth
          options={searchResults}
          loading={searchLoading}
          value={selectedAnime}
          inputValue={searchInput}
          onInputChange={(_event, value) => onSearchInputChange(value)}
          onChange={(_event, value) => onSelectedAnimeChange(value)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          getOptionLabel={(option) => formatAnimeTitle(option)}
          noOptionsText={searchInput.trim().length < 2 ? "Type at least 2 characters" : "No AniList results"}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id} sx={{ bgcolor: "rgba(18,24,34,0.98)", color: "grey.100", py: 1 }}>
              <AnimeMediaRow anime={option} dense />
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label={searchMediaType === "manga" ? "Manga Search" : "Anime Search"}
              placeholder={searchMediaType === "manga" ? "Solo Leveling, Omniscient Reader, or AniList ID" : "Frieren, Apothecary Diaries, or AniList ID"}
              helperText={getSubscribeHint({ anime: selectedAnime, channelId, saving })}
              sx={fieldSx}
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  endAdornment: <>{searchLoading ? <CircularProgress size={18} /> : null}{params.slotProps.input.endAdornment}</>,
                },
                formHelperText: {
                  sx: { color: selectedAnime && !canSubscribe(selectedAnime) ? "warning.light" : "rgba(255,255,255,0.48)" },
                },
              }}
            />
          )}
        />

        <LookupHistoryPanel
          history={lookupHistory}
          mediaType={searchMediaType}
          onUse={onUseLookupHistory}
          onClear={onClearLookupHistory}
        />

        {selectedAnime && (
          <Box sx={{ p: 1.25, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <AnimeMediaRow anime={selectedAnime} />
          </Box>
        )}

        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Autocomplete
            fullWidth
            openOnFocus
            options={channels}
            loading={loadingChannels}
            value={selectedChannel}
            onChange={(_event, value) => onChannelChange(value?.id ?? "")}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) => `#${option.name}`}
            sx={{ flex: 1 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Notification Channel"
                inputRef={notificationChannelInputRef}
                helperText={channelId ? "Season browse subscribe buttons will use this channel too." : "Required for server subscriptions."}
                sx={{
                  ...fieldSx,
                  ...(needsChannel ? {
                    "& .MuiOutlinedInput-root fieldset": { borderColor: "rgba(255,200,87,0.55)" },
                  } : {}),
                }}
              />
            )}
          />
          {onRefreshChannels && (
            <Tooltip title="Refresh channels">
              <span>
                <IconButton
                  aria-label="Refresh channels"
                  onClick={() => void onRefreshChannels()}
                  disabled={loadingChannels}
                  sx={{ mt: 0.5, color: "grey.200", border: "1px solid rgba(255,255,255,0.14)" }}
                >
                  <Refresh fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>

        <TextField
          fullWidth
          select
          label="Reminder Timing"
          value={reminderMinutes}
          onChange={(event) => onReminderMinutesChange(Number(event.target.value))}
          helperText="How long before the episode air time to notify."
          sx={fieldSx}
        >
          {[0, 5, 10, 15, 30, 60, 120, 360].map((minutes) => (
            <MenuItem key={minutes} value={minutes}>
              {minutes === 0 ? "At Air Time" : `${minutes} Minutes Before`}
            </MenuItem>
          ))}
        </TextField>

        {needsChannel && (
          <Alert severity="info" sx={{ bgcolor: "rgba(2,169,255,0.10)", color: "grey.100", border: "1px solid rgba(104,215,255,0.22)" }}>
            The subscribe action is available, but it will ask for a channel until one is selected.
          </Alert>
        )}

        <Button
          fullWidth
          variant="contained"
          startIcon={<Add />}
          disabled={subscribeDisabled}
          onClick={() => onSubscribe()}
          sx={primaryButtonSx}
        >
          {subscribeLabel({ saving, selectedAnime, searchInput, channelId, searchMediaType })}
        </Button>
      </Stack>
    </Paper>
  );
}
