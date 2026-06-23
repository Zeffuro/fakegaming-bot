"use client";

import React, { useMemo, useState } from "react";
import { Delete, DeleteSweep, FilterList, PauseCircleOutlined, PlayCircleOutlined, Search, WarningAmber } from "@mui/icons-material";
import { Box, Button, Card, CardActions, CardContent, Chip, MenuItem, Paper, Stack, TextField, Typography, type SxProps, type Theme } from "@mui/material";
import { dangerButtonSx, elevatedPanelSx, fieldSx, ghostButtonSx } from "@/components/anime/animeTheme";
import { subscriptionMeta, subscriptionTitle } from "@/components/anime/animeUtils";
import {
  combineAnimeSubscriptions,
  filterAnimeSubscriptions,
  type AnimeSubscriptionStatusFilter,
  type FilterableAnimeSubscription,
} from "@/lib/animeSubscriptionFilters";
import { findDuplicateAnimeSubscriptionGroups, getDuplicateAnimeSubscriptionsToRemove, type DuplicateAnimeSubscriptionGroup } from "@/lib/animeSubscriptionReview";
import type { AnimeSubscriptionDashboardConfig } from "@/lib/api-client";

interface AnimeSubscriptionsPanelProps {
  serverSubs: AnimeSubscriptionDashboardConfig[];
  personalSubs: AnimeSubscriptionDashboardConfig[];
  saving: boolean;
  getChannelName: (channelId: string) => string;
  onTogglePaused: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
  onSetPaused: (configs: AnimeSubscriptionDashboardConfig[], paused: boolean) => void | Promise<void>;
  onDelete: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
  onDeleteMany: (configs: AnimeSubscriptionDashboardConfig[]) => void | Promise<void>;
}

interface SubscriptionCardProps {
  config: AnimeSubscriptionDashboardConfig;
  saving: boolean;
  channelName?: string;
  onTogglePaused: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
  onDelete: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
}

function SubscriptionCard({ config, saving, channelName, onTogglePaused, onDelete }: SubscriptionCardProps) {
  const paused = Boolean(config.paused);
  const PauseIcon = paused ? PlayCircleOutlined : PauseCircleOutlined;

  return (
    <Card sx={{ bgcolor: "rgba(8,13,22,0.76)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3 }}>
      <CardContent sx={{ pb: 1.5 }}>
        <Stack spacing={0.75}>
          <Typography sx={{ color: "grey.50", fontWeight: 800 }}>{subscriptionTitle(config)}</Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
            {subscriptionMeta(config)}
          </Typography>
          {channelName && (
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
              Channel: {channelName}
            </Typography>
          )}
        </Stack>
      </CardContent>
      <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 2 }}>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
          <Chip size="small" label={`AniList #${config.anilistId}`} variant="outlined" sx={{ color: "rgba(255,255,255,0.68)", borderColor: "rgba(255,255,255,0.16)" }} />
          {paused && <Chip size="small" label="Paused" color="info" variant="outlined" />}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<PauseIcon />} disabled={saving} onClick={() => onTogglePaused(config)} sx={ghostButtonSx}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="small" variant="outlined" color="error" startIcon={<Delete />} disabled={saving} onClick={() => onDelete(config)} sx={dangerButtonSx}>
            Remove
          </Button>
        </Stack>
      </CardActions>
    </Card>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", color: "rgba(255,255,255,0.58)" }}>
      {children}
    </Box>
  );
}

interface SubscriptionSectionProps {
  title: string;
  count: number;
  totalCount: number;
  chipSx: SxProps<Theme>;
  emptyMessage: string;
  filteredEmptyMessage?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const statusFilterOptions: Array<{ value: AnimeSubscriptionStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "airing-known", label: "Airing Known" },
  { value: "airing-missing", label: "Airing Missing" },
];

function SubscriptionSection({ title, count, totalCount, chipSx, emptyMessage, filteredEmptyMessage, description, actions, children }: SubscriptionSectionProps) {
  return (
    <Paper sx={{ ...elevatedPanelSx, p: 3 }}>
      <Stack spacing={2} sx={{ position: "relative" }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>
            {title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            {actions}
            <Chip label={count === totalCount ? count : `${count}/${totalCount}`} sx={chipSx} />
          </Stack>
        </Stack>
        {description && (
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
            {description}
          </Typography>
        )}
        {count === 0 ? <EmptyState>{totalCount === 0 ? emptyMessage : filteredEmptyMessage ?? "No subscriptions match the current filters."}</EmptyState> : children}
      </Stack>
    </Paper>
  );
}

interface BulkPauseActionsProps {
  configs: AnimeSubscriptionDashboardConfig[];
  saving: boolean;
  onSetPaused: (paused: boolean) => void | Promise<void>;
}

function hasId(config: AnimeSubscriptionDashboardConfig): boolean {
  return config.id !== undefined && config.id !== null;
}

function BulkPauseActions({ configs, saving, onSetPaused }: BulkPauseActionsProps) {
  const activeCount = configs.filter((config) => hasId(config) && !config.paused).length;
  const pausedCount = configs.filter((config) => hasId(config) && Boolean(config.paused)).length;

  if (configs.length === 0) return null;

  return (
    <>
      <Button size="small" variant="outlined" startIcon={<PauseCircleOutlined />} disabled={saving || activeCount === 0} onClick={() => void onSetPaused(true)} sx={ghostButtonSx}>
        Pause Active ({activeCount})
      </Button>
      <Button size="small" variant="outlined" startIcon={<PlayCircleOutlined />} disabled={saving || pausedCount === 0} onClick={() => void onSetPaused(false)} sx={ghostButtonSx}>
        Resume Paused ({pausedCount})
      </Button>
    </>
  );
}

function duplicateDestinationLabel(group: DuplicateAnimeSubscriptionGroup, getChannelName: (channelId: string) => string): string {
  if (group.scope === "personal") return "DM reminder";
  return `Channel: ${getChannelName(group.destinationId)}`;
}

function DuplicateSubscriptionReview({
  groups,
  saving,
  getChannelName,
  onDelete,
  onDeleteMany,
}: {
  groups: DuplicateAnimeSubscriptionGroup[];
  saving: boolean;
  getChannelName: (channelId: string) => string;
  onDelete: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
  onDeleteMany: (configs: AnimeSubscriptionDashboardConfig[]) => void | Promise<void>;
}) {
  if (groups.length === 0) return null;

  return (
    <Paper sx={{ ...elevatedPanelSx, p: 2.5 }}>
      <Stack spacing={1.75} sx={{ position: "relative" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
          <Box>
            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, display: "flex", alignItems: "center", gap: 1 }}>
              <WarningAmber fontSize="small" />
              Duplicate Review
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>
              Same AniList title routed to the same destination more than once.
            </Typography>
          </Box>
          <Chip label={`${groups.length} group${groups.length === 1 ? "" : "s"}`} sx={{ bgcolor: "rgba(255,200,87,0.12)", color: "grey.50", border: "1px solid rgba(255,200,87,0.24)" }} />
        </Stack>

        <Stack spacing={1.25}>
          {groups.map((group) => (
            <DuplicateSubscriptionGroupCard
              key={group.key}
              group={group}
              saving={saving}
              getChannelName={getChannelName}
              onDelete={onDelete}
              onDeleteMany={onDeleteMany}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

function DuplicateSubscriptionGroupCard({
  group,
  saving,
  getChannelName,
  onDelete,
  onDeleteMany,
}: {
  group: DuplicateAnimeSubscriptionGroup;
  saving: boolean;
  getChannelName: (channelId: string) => string;
  onDelete: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
  onDeleteMany: (configs: AnimeSubscriptionDashboardConfig[]) => void | Promise<void>;
}) {
  const removable = getDuplicateAnimeSubscriptionsToRemove(group).map((item) => item.config);
  const removableCount = removable.filter((config) => config.id !== undefined && config.id !== null).length;

  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Stack spacing={1}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: "grey.50", fontWeight: 850, overflowWrap: "anywhere" }}>
                      {group.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                      AniList #{group.anilistId} - {duplicateDestinationLabel(group, getChannelName)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                    <Chip size="small" label={`${group.count} duplicates`} sx={{ bgcolor: "rgba(255,200,87,0.10)", color: "rgba(255,255,255,0.78)" }} />
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteSweep />}
                      disabled={saving || removableCount === 0}
                      onClick={() => void onDeleteMany(removable)}
                      sx={dangerButtonSx}
                    >
                      Remove Extras ({removableCount})
                    </Button>
                  </Stack>
                </Stack>

                <Stack spacing={0.75}>
                  {group.subscriptions.map((item, index) => (
                    <DuplicateSubscriptionRow key={`${group.key}:${item.config.id ?? item.config.anilistId}:${index}`} item={item} saving={saving} onDelete={onDelete} />
                  ))}
                </Stack>
              </Stack>
            </Box>
  );
}

function DuplicateSubscriptionRow({
  item,
  saving,
  onDelete,
}: {
  item: FilterableAnimeSubscription;
  saving: boolean;
  onDelete: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "space-between", p: 1, borderRadius: 2, bgcolor: "rgba(0,0,0,0.16)" }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.74)", display: "block", overflowWrap: "anywhere" }}>
          Subscription #{item.config.id ?? "unknown"} - {item.config.paused ? "paused" : "active"}
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.44)", display: "block" }}>
          {item.scope === "server" ? "Server channel" : "Personal DM"} - {item.config.reminderMinutes ?? 30} min reminder
        </Typography>
      </Box>
      <Button size="small" variant="outlined" color="error" startIcon={<Delete />} disabled={saving || !item.config.id} onClick={() => void onDelete(item.config)} sx={dangerButtonSx}>
        Remove
      </Button>
    </Box>
  );
}

export function AnimeSubscriptionsPanel({ serverSubs, personalSubs, saving, getChannelName, onTogglePaused, onSetPaused, onDelete, onDeleteMany }: AnimeSubscriptionsPanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AnimeSubscriptionStatusFilter>("all");
  const channelNames = useMemo(() => {
    const names: Record<string, string | undefined> = {};
    for (const config of serverSubs) {
      const channelId = config.channelId ?? config.discordChannelId;
      if (channelId) names[channelId] = getChannelName(channelId);
    }
    return names;
  }, [getChannelName, serverSubs]);
  const allSubscriptions = useMemo(() => combineAnimeSubscriptions(serverSubs, personalSubs), [personalSubs, serverSubs]);
  const duplicateGroups = useMemo(() => findDuplicateAnimeSubscriptionGroups(allSubscriptions), [allSubscriptions]);
  const filteredSubscriptions = useMemo(() => {
    return filterAnimeSubscriptions(allSubscriptions, {
      query,
      status: statusFilter,
      channelNames,
    });
  }, [allSubscriptions, channelNames, query, statusFilter]);
  const filteredServerSubs = filteredSubscriptions.filter((item) => item.scope === "server").map((item) => item.config);
  const filteredPersonalSubs = filteredSubscriptions.filter((item) => item.scope === "personal").map((item) => item.config);
  const filtersActive = Boolean(query.trim()) || statusFilter !== "all";

  return (
    <Stack spacing={2.5}>
      <Paper sx={{ ...elevatedPanelSx, p: 2.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ position: "relative", alignItems: { md: "center" } }}>
          <TextField
            label="Search subscriptions"
            placeholder="Title, AniList ID, channel, status, or scope"
            size="small"
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={fieldSx}
            slotProps={{
              input: {
                startAdornment: <Search fontSize="small" sx={{ mr: 1, color: "rgba(255,255,255,0.46)" }} />,
              },
            }}
          />
          <TextField
            select
            label="Filter"
            size="small"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as AnimeSubscriptionStatusFilter)}
            sx={{ ...fieldSx, minWidth: { xs: "100%", md: 190 } }}
          >
            {statusFilterOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
          <Chip
            icon={<FilterList />}
            label={filtersActive ? `${filteredSubscriptions.length}/${serverSubs.length + personalSubs.length} shown` : `${serverSubs.length + personalSubs.length} total`}
            sx={{ alignSelf: { xs: "flex-start", md: "center" }, bgcolor: "rgba(104,215,255,0.12)", color: "grey.50", border: "1px solid rgba(104,215,255,0.24)" }}
          />
        </Stack>
      </Paper>

      <DuplicateSubscriptionReview
        groups={duplicateGroups}
        saving={saving}
        getChannelName={getChannelName}
        onDelete={onDelete}
        onDeleteMany={onDeleteMany}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(320px, 2fr)" }, gap: 3 }}>
      <SubscriptionSection
        title="Server Channel Subscriptions"
        count={filteredServerSubs.length}
        totalCount={serverSubs.length}
        chipSx={{ bgcolor: "rgba(104,215,255,0.14)", color: "grey.50" }}
        emptyMessage="No server channel anime subscriptions configured."
        filteredEmptyMessage="No server channel subscriptions match the current filters."
        actions={<BulkPauseActions configs={filteredServerSubs} saving={saving} onSetPaused={(paused) => onSetPaused(filteredServerSubs, paused)} />}
      >
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
          {filteredServerSubs.map((config) => (
            <SubscriptionCard
              key={config.id ?? `${config.anilistId}-${config.channelId}`}
              config={config}
              saving={saving}
              channelName={getChannelName(config.discordChannelId)}
              onTogglePaused={onTogglePaused}
              onDelete={onDelete}
            />
          ))}
        </Box>
      </SubscriptionSection>

      <SubscriptionSection
        title="Your DM Subscriptions"
        count={filteredPersonalSubs.length}
        totalCount={personalSubs.length}
        chipSx={{ bgcolor: "rgba(255,200,87,0.12)", color: "grey.50" }}
        emptyMessage="No personal anime subscriptions."
        filteredEmptyMessage="No personal subscriptions match the current filters."
        description="Personal `/anime subscribe` reminders are listed here so they are not invisible from the dashboard."
        actions={<BulkPauseActions configs={filteredPersonalSubs} saving={saving} onSetPaused={(paused) => onSetPaused(filteredPersonalSubs, paused)} />}
      >
        <Stack spacing={1.5}>
          {filteredPersonalSubs.map((config) => (
            <SubscriptionCard
              key={config.id ?? config.anilistId}
              config={config}
              saving={saving}
              onTogglePaused={onTogglePaused}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      </SubscriptionSection>
      </Box>
    </Stack>
  );
}
