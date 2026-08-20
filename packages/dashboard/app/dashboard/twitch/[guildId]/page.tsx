"use client";
import React from "react";
import { LiveTv } from "@mui/icons-material";
import type { TwitchStreamConfig } from "@zeffuro/fakegaming-common";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { useTwitchConfigs } from "@/components/hooks/useTwitch";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function GuildTwitchPage() {
  const { t } = useDashboardI18n();
  const useConfigs = (guildId: string) => useTwitchConfigs(guildId);
  return (
    <IntegrationConfigPage<TwitchStreamConfig>
      useConfigs={useConfigs}
      moduleTitle={t("provider.twitchTitle")}
      moduleIcon={<LiveTv color="secondary" />}
      moduleColor="#9146FF"
      moduleName="Twitch"
      provider="twitch"
      channelNameField="twitchUsername"
      channelNameLabel={t("provider.channelName")}
      channelNamePlaceholder="shroud"
    />
  );
}
