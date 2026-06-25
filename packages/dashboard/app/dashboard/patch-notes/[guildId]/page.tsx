"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Close, CompareArrows, OpenInNew, Refresh, Search, SpeakerNotes } from "@mui/icons-material";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { PatchSubscriptionUIConfig } from "@/components/hooks/usePatchSubscriptions";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { usePatchSubscriptions } from "@/components/hooks/usePatchSubscriptions";
import { useSupportedGames } from "@/components/hooks/useSupportedGames";
import { useLatestPatchNotes } from "@/components/hooks/useLatestPatchNotes";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardDialogPaperSx, dashboardFieldSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { api, type PatchNoteHistoryCompareResponse, type PatchNoteHistoryDiffLine, type PatchNoteHistoryItem } from "@/lib/api-client";

export default function GuildPatchNotesPage() {
  const { guildId } = useGuildFromParams();
  const configsApi = usePatchSubscriptions(guildId as string);
  const { games } = useSupportedGames();
  const { latestByGame } = useLatestPatchNotes(configsApi.configs);

  return (
    <IntegrationConfigPage<PatchSubscriptionUIConfig>
      useConfigs={usePatchSubscriptions as unknown as (guildId: string) => any}
      configsApi={configsApi as any}
      moduleTitle="Patch Note Subscriptions"
      moduleIcon={<SpeakerNotes color="secondary" />}
      moduleColor="#7C4DFF"
      moduleName="Patch Notes"
      provider="patchnotes"
      channelNameField="game"
      channelNameLabel="Game"
      channelNamePlaceholder="League of Legends"
      showCustomMessage={false}
      showNotificationControls={false}
      itemSingularLabel="Game Subscription"
      itemPluralLabel="Game Subscriptions"
      itemNameOptions={games}
      allowEdit={false}
      extraContent={<PatchNotesTimeline games={games} />}
      renderChip={(cfg) => {
        const info = (latestByGame as Record<string, { version?: string }>)[(cfg as any).game];
        if (!info) return undefined;
        const label = info.version ? `Latest: ${info.version}` : 'Latest patch';
        return { label, color: 'info', variant: 'outlined' };
      }}
    />
  );
}

function PatchNotesTimeline({ games }: { games: string[] }) {
  const accent = dashboardAccents.patchNotes;
  const limit = 12;
  const [items, setItems] = useState<PatchNoteHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [game, setGame] = useState("");
  const [query, setQuery] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<PatchNoteHistoryItem[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<PatchNoteHistoryCompareResponse | null>(null);

  const pageNumber = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const [firstSelected, secondSelected] = selectedItems;
  const canCompare = Boolean(firstSelected && secondSelected && firstSelected.game === secondSelected.game);
  const gameOptions = useMemo(() => {
    const values = new Set(games);
    for (const item of items) values.add(item.game);
    return [...values].sort((left, right) => left.localeCompare(right));
  }, [games, items]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.getPatchNoteHistory({
          game: game || undefined,
          limit,
          offset,
          q: query.trim() || undefined,
        });
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (err: unknown) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load patch-note history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [game, offset, query, refreshToken]);

  const refresh = () => {
    setOffset(0);
    setRefreshToken((current) => current + 1);
  };

  const toggleCompareSelection = (item: PatchNoteHistoryItem) => {
    setSelectedItems((current) => {
      if (current.some(selected => selected.id === item.id)) {
        return current.filter(selected => selected.id !== item.id);
      }
      const first = current[0];
      if (first && first.game !== item.game) {
        return [item];
      }
      if (current.length >= 2) {
        const second = current[1];
        return second ? [second, item] : [item];
      }
      return [...current, item];
    });
  };

  const clearCompareSelection = () => {
    setSelectedItems([]);
    setCompareResult(null);
    setCompareError(null);
  };

  const openCompare = async () => {
    if (!canCompare) return;
    const ordered = [...selectedItems].sort((left, right) => left.publishedAt - right.publishedAt || left.id - right.id);
    const [leftItem, rightItem] = ordered;
    if (!leftItem || !rightItem) return;
    try {
      setCompareOpen(true);
      setCompareLoading(true);
      setCompareError(null);
      setCompareResult(null);
      const result = await api.comparePatchNoteHistory({
        leftId: leftItem.id,
        rightId: rightItem.id,
      });
      setCompareResult(result);
    } catch (err: unknown) {
      setCompareError(err instanceof Error ? err.message : "Failed to compare patch notes");
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <FeaturePanel accent={accent}>
      <Stack spacing={2.25} sx={{ position: "relative" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" } }}>
          <Box>
            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>
              Patch note timeline
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.4 }}>
              {total > 0 ? `${total} stored patches, latest first.` : "No stored patches match these filters."}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            <Button variant="outlined" onClick={refresh} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
              Refresh
            </Button>
            <Button variant="contained" onClick={openCompare} disabled={!canCompare || compareLoading} startIcon={<CompareArrows />} sx={primaryActionButtonSx(accent)}>
              Compare selected
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
          <TextField
            select
            label="Game"
            value={game}
            onChange={(event) => {
              setGame(event.target.value);
              setOffset(0);
            }}
            sx={{ minWidth: { xs: "100%", md: 220 }, ...dashboardFieldSx(accent) }}
          >
            <MenuItem value="">All games</MenuItem>
            {gameOptions.map(option => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOffset(0);
            }}
            sx={{ flex: 1, ...dashboardFieldSx(accent) }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: "rgba(255,255,255,0.60)" }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>

        {selectedItems.length > 0 ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
              {selectedItems.length}/2 selected
            </Typography>
            {selectedItems.map(item => (
              <Chip
                key={item.id}
                label={`${item.version ?? item.title} (${item.game})`}
                onDelete={() => toggleCompareSelection(item)}
                sx={{ maxWidth: 260, bgcolor: alpha(accent, 0.14), color: "grey.50", border: `1px solid ${alpha(accent, 0.34)}` }}
              />
            ))}
            <Button size="small" variant="text" onClick={clearCompareSelection} sx={{ color: "rgba(255,255,255,0.62)", textTransform: "none" }}>
              Clear
            </Button>
          </Stack>
        ) : null}

        {error ? (
          <Alert severity="error" sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.24)}` }}>
            {error}
          </Alert>
        ) : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
          {items.map(item => (
            <PatchNoteTimelineCard
              key={item.id}
              item={item}
              selected={selectedItems.some(selected => selected.id === item.id)}
              onToggleCompare={toggleCompareSelection}
            />
          ))}
        </Box>

        {!loading && items.length === 0 ? (
          <Box sx={{ borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "rgba(255,255,255,0.045)", p: 2, color: "rgba(255,255,255,0.62)" }}>
            <Typography variant="body2">No patch notes found.</Typography>
          </Box>
        ) : null}

        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>
            Page {pageNumber} of {pageCount}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} sx={ghostActionButtonSx(accent)}>
              Previous
            </Button>
            <Button variant="outlined" disabled={loading || offset + limit >= total} onClick={() => setOffset(offset + limit)} sx={ghostActionButtonSx(accent)}>
              Next
            </Button>
          </Stack>
        </Stack>

        <PatchNoteCompareDialog
          error={compareError}
          loading={compareLoading}
          onClose={() => setCompareOpen(false)}
          open={compareOpen}
          result={compareResult}
        />
      </Stack>
    </FeaturePanel>
  );
}

function PatchNoteTimelineCard({ item, onToggleCompare, selected }: { item: PatchNoteHistoryItem; onToggleCompare: (item: PatchNoteHistoryItem) => void; selected: boolean }) {
  const accent = dashboardAccents.patchNotes;
  return (
    <Box sx={{ borderRadius: 2, border: selected ? `1px solid ${alpha(accent, 0.56)}` : "1px solid rgba(255,255,255,0.08)", bgcolor: selected ? alpha(accent, 0.10) : "rgba(255,255,255,0.045)", p: 2 }}>
      <Stack spacing={1.2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          <Chip size="small" label={item.game} sx={{ bgcolor: alpha(accent, 0.16), color: "grey.50", border: `1px solid ${alpha(accent, 0.36)}` }} />
          {item.version ? (
            <Chip size="small" label={item.version} sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.76)" }} />
          ) : null}
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)", ml: "auto" }}>
            {formatPatchTimestamp(item.publishedAt)}
          </Typography>
        </Stack>
        <Typography variant="subtitle1" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.18 }}>
          {item.title}
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.66)" }}>
          {item.contentPreview || "No preview available."}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 1 }}>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
            {formatBytes(item.contentBytes)}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            <Button size="small" variant={selected ? "contained" : "outlined"} startIcon={<CompareArrows />} onClick={() => onToggleCompare(item)} sx={selected ? primaryActionButtonSx(accent) : ghostActionButtonSx(accent)}>
              {selected ? "Selected" : "Select"}
            </Button>
            <Button component="a" href={item.url} target="_blank" rel="noreferrer" size="small" variant="outlined" startIcon={<OpenInNew />} sx={ghostActionButtonSx(accent)}>
              Open
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}

function PatchNoteCompareDialog({ error, loading, onClose, open, result }: {
  error: string | null;
  loading: boolean;
  onClose: () => void;
  open: boolean;
  result: PatchNoteHistoryCompareResponse | null;
}) {
  const accent = dashboardAccents.patchNotes;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" slotProps={{ paper: { sx: dashboardDialogPaperSx(accent) } }}>
      <DialogTitle sx={{ color: "grey.100", fontWeight: 900 }}>
        Patch compare
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.66)" }}>
            Loading compare...
          </Typography>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.24)}` }}>
            {error}
          </Alert>
        ) : null}
        {!loading && result ? (
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
              <PatchCompareRecordSummary label="From" record={result.left} />
              <PatchCompareRecordSummary label="To" record={result.right} />
            </Box>

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Chip size="small" label={`+${result.summary.addedLines}`} sx={{ bgcolor: "rgba(34,197,94,0.14)", color: "#BBF7D0", border: "1px solid rgba(34,197,94,0.32)" }} />
              <Chip size="small" label={`-${result.summary.removedLines}`} sx={{ bgcolor: "rgba(248,113,113,0.14)", color: "#FECACA", border: "1px solid rgba(248,113,113,0.32)" }} />
              <Chip size="small" label={`${result.summary.unchangedLines} unchanged`} sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.70)" }} />
            </Stack>

            {result.summary.truncated ? (
              <Alert severity="warning" sx={{ bgcolor: "rgba(251,191,36,0.12)", color: "grey.50", border: "1px solid rgba(251,191,36,0.24)" }}>
                Diff truncated to {result.summary.emittedLines} of {result.summary.totalDiffLines} lines.
              </Alert>
            ) : null}

            <Box sx={{ maxHeight: 520, overflow: "auto", borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "rgba(0,0,0,0.22)" }}>
              {result.diff.map((line, index) => (
                <PatchCompareLine key={`${index}-${line.kind}`} line={line} />
              ))}
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="outlined" startIcon={<Close />} sx={ghostActionButtonSx(accent)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PatchCompareRecordSummary({ label, record }: { label: string; record: PatchNoteHistoryCompareResponse["left"] }) {
  return (
    <Box sx={{ borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "rgba(255,255,255,0.045)", p: 1.5 }}>
      <Stack spacing={0.75}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.50)", fontWeight: 800, textTransform: "uppercase" }}>
          {label}
        </Typography>
        <Typography variant="subtitle2" sx={{ color: "grey.50", fontWeight: 850 }}>
          {record.title}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          {record.version ? (
            <Chip size="small" label={record.version} sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.76)" }} />
          ) : null}
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.50)" }}>
            {formatPatchTimestamp(record.publishedAt)} · {formatBytes(record.contentBytes)}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

function PatchCompareLine({ line }: { line: PatchNoteHistoryDiffLine }) {
  const marker = line.kind === "added" ? "+" : line.kind === "removed" ? "-" : "";
  const color = line.kind === "added" ? "#BBF7D0" : line.kind === "removed" ? "#FECACA" : "rgba(255,255,255,0.76)";
  const bgcolor = line.kind === "added"
    ? "rgba(34,197,94,0.10)"
    : line.kind === "removed"
      ? "rgba(248,113,113,0.10)"
      : "transparent";

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "48px 48px 28px minmax(0, 1fr)", gap: 0.75, px: 1, py: 0.55, bgcolor, borderBottom: "1px solid rgba(255,255,255,0.045)", fontFamily: "monospace", fontSize: "0.82rem" }}>
      <Box sx={{ color: "rgba(255,255,255,0.36)", textAlign: "right" }}>{line.leftLine ?? ""}</Box>
      <Box sx={{ color: "rgba(255,255,255,0.36)", textAlign: "right" }}>{line.rightLine ?? ""}</Box>
      <Box sx={{ color, fontWeight: 900 }}>{marker}</Box>
      <Box sx={{ color, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{line.text}</Box>
    </Box>
  );
}

function formatPatchTimestamp(value: number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString();
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let amount = value;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
}
