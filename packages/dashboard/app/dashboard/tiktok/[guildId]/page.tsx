"use client";
import React from "react";
import { LiveTv } from "@mui/icons-material";
import type { TikTokStreamConfig } from "@zeffuro/fakegaming-common";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { useTikTokConfigs } from "@/components/hooks/useTikTok";

export default function GuildTikTokPage() {
  const useConfigs = (guildId: string) => useTikTokConfigs(guildId);
  return (
    <IntegrationConfigPage<TikTokStreamConfig>
      useConfigs={useConfigs}
      moduleTitle="TikTok Live Notifications"
      moduleIcon={<LiveTv color="secondary" />}
      moduleColor="#000000"
      moduleName="TikTok"
      channelNameField="tiktokUsername"
      channelNameLabel="Channel Name"
      channelNamePlaceholder="somecreator"
    />
  );
}

