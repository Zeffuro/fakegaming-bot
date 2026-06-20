"use client";

import React from "react";
import { Delete } from "@mui/icons-material";
import { Box, Button, Card, CardActions, CardContent, Chip, Paper, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import { dangerButtonSx, elevatedPanelSx } from "@/components/anime/animeTheme";
import { subscriptionMeta, subscriptionTitle } from "@/components/anime/animeUtils";
import type { AnimeSubscriptionDashboardConfig } from "@/lib/api-client";

interface AnimeSubscriptionsPanelProps {
  serverSubs: AnimeSubscriptionDashboardConfig[];
  personalSubs: AnimeSubscriptionDashboardConfig[];
  saving: boolean;
  getChannelName: (channelId: string) => string;
  onDelete: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
}

interface SubscriptionCardProps {
  config: AnimeSubscriptionDashboardConfig;
  saving: boolean;
  channelName?: string;
  onDelete: (config: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
}

function SubscriptionCard({ config, saving, channelName, onDelete }: SubscriptionCardProps) {
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
        <Chip size="small" label={`AniList #${config.anilistId}`} variant="outlined" sx={{ color: "rgba(255,255,255,0.68)", borderColor: "rgba(255,255,255,0.16)" }} />
        <Button size="small" variant="outlined" color="error" startIcon={<Delete />} disabled={saving} onClick={() => onDelete(config)} sx={dangerButtonSx}>
          Remove
        </Button>
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
  children: React.ReactNode;
}

function SubscriptionSection({ title, count, chipSx, emptyMessage, description, children }: SubscriptionSectionProps) {
  return (
    <Paper sx={{ ...elevatedPanelSx, p: 3 }}>
      <Stack spacing={2} sx={{ position: "relative" }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>
            {title}
          </Typography>
          <Chip label={count} sx={chipSx} />
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

export function AnimeSubscriptionsPanel({ serverSubs, personalSubs, saving, getChannelName, onDelete }: AnimeSubscriptionsPanelProps) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(320px, 2fr)" }, gap: 3 }}>
      <SubscriptionSection
        title="Server Channel Subscriptions"
        count={serverSubs.length}
        chipSx={{ bgcolor: "rgba(104,215,255,0.14)", color: "grey.50" }}
        emptyMessage="No server channel anime subscriptions configured."
      >
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
          {serverSubs.map((config) => (
            <SubscriptionCard
              key={config.id ?? `${config.anilistId}-${config.channelId}`}
              config={config}
              saving={saving}
              channelName={getChannelName(config.discordChannelId)}
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
      >
        <Stack spacing={1.5}>
          {personalSubs.map((config) => (
            <SubscriptionCard
              key={config.id ?? config.anilistId}
              config={config}
              saving={saving}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      </SubscriptionSection>
    </Box>
  );
}
