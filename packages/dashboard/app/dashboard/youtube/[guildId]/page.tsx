"use client";
import React from "react";
import { YouTube as YouTubeIcon } from "@mui/icons-material";
import type { YoutubeVideoConfig } from "@zeffuro/fakegaming-common";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { useYouTubeConfigs } from "@/components/hooks/useYouTube";

export default function GuildYouTubePage() {
  const useConfigs = (guildId: string) => useYouTubeConfigs(guildId);
  return (
    <IntegrationConfigPage<YoutubeVideoConfig>
      useConfigs={useConfigs}
      moduleTitle="YouTube Notifications"
      moduleIcon={<YouTubeIcon color="error" />}
      moduleColor="#FF0000"
      moduleName="YouTube"
      channelNameField="youtubeChannelId"
      channelNameLabel="Channel ID"
      channelNamePlaceholder="UCsBjURrPoezykLs9EqgamOA"
      renderChip={(config) => (config as any).lastVideoId ? {
        label: `Last Video: ${(config as any).lastVideoId}`,
        color: "default",
        variant: "outlined"
      } : undefined}
    />
  );
}
