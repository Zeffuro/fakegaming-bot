"use client";
import React from "react";
import { LiveTv } from "@mui/icons-material";
import type { TwitchStreamConfig } from "@zeffuro/fakegaming-common";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { useTwitchConfigs } from "@/components/hooks/useTwitch";

export default function GuildTwitchPage() {
  const useConfigs = (guildId: string) => useTwitchConfigs(guildId);
  return (
    <IntegrationConfigPage<TwitchStreamConfig>
      useConfigs={useConfigs}
      moduleTitle="Twitch Live Notifications"
      moduleIcon={<LiveTv color="secondary" />}
      moduleColor="#9146FF"
      moduleName="Twitch"
      channelNameField="twitchUsername"
      channelNameLabel="Channel Name"
      channelNamePlaceholder="shroud"
    />
  );
}
