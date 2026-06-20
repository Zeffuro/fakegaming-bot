"use client";
import React from "react";
import { AlternateEmail } from "@mui/icons-material";
import type { BlueskyPostConfig } from "@zeffuro/fakegaming-common";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { useBlueskyConfigs } from "@/components/hooks/useBluesky";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";

export default function GuildBlueskyPage() {
  const useConfigs = (guildId: string) => useBlueskyConfigs(guildId);
  return (
    <IntegrationConfigPage<BlueskyPostConfig>
      useConfigs={useConfigs}
      moduleTitle="Bluesky Post Notifications"
      moduleIcon={<AlternateEmail />}
      moduleColor={dashboardAccents.bluesky}
      moduleName="Bluesky"
      provider="bluesky"
      channelNameField="blueskyHandle"
      channelNameLabel="Handle"
      channelNamePlaceholder="bsky.app"
      itemSingularLabel="Account"
      itemPluralLabel="Accounts"
    />
  );
}
