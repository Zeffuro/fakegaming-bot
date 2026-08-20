"use client";
import React from "react";
import { LiveTv } from "@mui/icons-material";
import type { TikTokStreamConfig } from "@zeffuro/fakegaming-common";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { useTikTokConfigs } from "@/components/hooks/useTikTok";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function GuildTikTokPage() {
  const { t } = useDashboardI18n();
  const useConfigs = (guildId: string) => useTikTokConfigs(guildId);
  return (
    <IntegrationConfigPage<TikTokStreamConfig>
      useConfigs={useConfigs}
      moduleTitle={t("provider.tiktokTitle")}
      moduleIcon={<LiveTv color="secondary" />}
      moduleColor="#000000"
      moduleName="TikTok"
      provider="tiktok"
      channelNameField="tiktokUsername"
      channelNameLabel={t("provider.channelName")}
      channelNamePlaceholder="somecreator"
    />
  );
}

