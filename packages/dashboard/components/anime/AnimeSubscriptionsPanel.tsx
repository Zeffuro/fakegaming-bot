"use client";

import React from "react";
import { Delete, PauseCircleOutlined, PlayCircleOutlined } from "@mui/icons-material";
import { Box, Button, Card, CardActions, CardContent, Chip, Paper, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import { dangerButtonSx, elevatedPanelSx, ghostButtonSx } from "@/components/anime/animeTheme";
import { subscriptionMeta, subscriptionTitle } from "@/components/anime/animeUtils";
import type { AnimeSubscriptionDashboardConfig } from "@/lib/api-client";

interface AnimeSubscriptionsPanelProps {
  serverSubs: AnimeSubscriptionDashboardConfig[];
  personalSubs: AnimeSubscriptionDashboardConfig[];
  saving: boolean;
  getChannelName: (channelId: string) => string;
  onTogglePaused: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
  onSetServerPaused: (paused: boolean) => void | Promise<void>;
  onSetPersonalPaused: (paused: boolean) => void | Promise<void>;
  onDelete: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
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
  chipSx: SxProps<Theme>;
  emptyMessage: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function SubscriptionSection({ title, count, chipSx, emptyMessage, description, actions, children }: SubscriptionSectionProps) {
  return (
    <Paper sx={{ ...elevatedPanelSx, p: 3 }}>
      <Stack spacing={2} sx={{ position: "relative" }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>
            {title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            {actions}
            <Chip label={count} sx={chipSx} />
          </Stack>
        </Stack>
        {description && (
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)" }}>
            {description}
          </Typography>
        )}
        {count === 0 ? <EmptyState>{emptyMessage}</EmptyState> : children}
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

export function AnimeSubscriptionsPanel({ serverSubs, personalSubs, saving, getChannelName, onTogglePaused, onSetServerPaused, onSetPersonalPaused, onDelete }: AnimeSubscriptionsPanelProps) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(320px, 2fr)" }, gap: 3 }}>
      <SubscriptionSection
        title="Server Channel Subscriptions"
        count={serverSubs.length}
        chipSx={{ bgcolor: "rgba(104,215,255,0.14)", color: "grey.50" }}
        emptyMessage="No server channel anime subscriptions configured."
        actions={<BulkPauseActions configs={serverSubs} saving={saving} onSetPaused={onSetServerPaused} />}
      >
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
          {serverSubs.map((config) => (
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
        count={personalSubs.length}
        chipSx={{ bgcolor: "rgba(255,200,87,0.12)", color: "grey.50" }}
        emptyMessage="No personal anime subscriptions."
        description="Personal `/anime subscribe` reminders are listed here so they are not invisible from the dashboard."
        actions={<BulkPauseActions configs={personalSubs} saving={saving} onSetPaused={onSetPersonalPaused} />}
      >
        <Stack spacing={1.5}>
          {personalSubs.map((config) => (
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
  );
}
