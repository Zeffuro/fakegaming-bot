"use client";
import React from "react";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { useTwitchConfigs } from "@/components/hooks/useTwitch";
import StreamingConfigPage from "@/components/StreamingConfigPage";
import { LiveTv } from "@mui/icons-material";
import type { TwitchStreamConfig } from "@zeffuro/fakegaming-common";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert } from "@mui/material";

export default function GuildTwitchPage() {
  const { guildId } = useParams();
  const { guilds, loading: guildsLoading } = useDashboardData();
  const guild = guilds.find(g => g.id === guildId);

  const {
    configs,
    loading,
    saving,
    error,
    setError,
    addConfig,
    updateConfig,
    deleteConfig
  } = useTwitchConfigs(guildId as string);

  if (!guild && !guildsLoading) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ bgcolor: 'error.dark', color: 'error.light' }}>
          Guild not found or you don't have access to this guild.
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <StreamingConfigPage<TwitchStreamConfig>
      guildId={guildId as string}
      guild={guild}
      configs={configs}
      loading={loading || guildsLoading}
      saving={saving}
      error={error}
      moduleTitle="Twitch Live Notifications"
      moduleIcon={<LiveTv color="secondary" />}
      moduleColor="#9146FF" // Twitch purple
      moduleName="Twitch"
      channelNameField="twitchUsername"
      channelNameLabel="Channel Name"
      channelNamePlaceholder="shroud"
      onSetError={setError}
      onAdd={addConfig}
      onUpdate={updateConfig}
      onDelete={deleteConfig}
      renderChip={undefined}
    />
  );
}
