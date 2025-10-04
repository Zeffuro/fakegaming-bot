"use client";
import React from "react";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { useYouTubeConfigs } from "@/components/hooks/useYouTube";
import StreamingConfigPage from "@/components/StreamingConfigPage";
import { YouTube } from "@mui/icons-material";
import type { YoutubeVideoConfig } from "@zeffuro/fakegaming-common";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert } from "@mui/material";

export default function GuildYouTubePage() {
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
  } = useYouTubeConfigs(guildId as string);

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
    <StreamingConfigPage<YoutubeVideoConfig>
      guildId={guildId as string}
      guild={guild}
      configs={configs}
      loading={loading || guildsLoading}
      saving={saving}
      error={error}
      moduleTitle="YouTube Notifications"
      moduleIcon={<YouTube color="error" />}
      moduleColor="#FF0000"
      moduleName="YouTube"
      channelNameField="youtubeChannelId"
      channelNameLabel="Channel ID"
      channelNamePlaceholder="UCsBjURrPoezykLs9EqgamOA"
      onSetError={setError}
      onAdd={addConfig}
      onUpdate={updateConfig}
      onDelete={deleteConfig}
      renderChip={(config) => config.lastVideoId ? {
        label: `Last Video: ${config.lastVideoId}`,
        color: "default",
        variant: "outlined"
      } : undefined}
    />
  );
}
