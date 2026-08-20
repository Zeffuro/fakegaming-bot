"use client";
import React from "react";
import { YouTube as YouTubeIcon } from "@mui/icons-material";
import type { YoutubeVideoConfig } from "@zeffuro/fakegaming-common";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { useYouTubeConfigs } from "@/components/hooks/useYouTube";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function GuildYouTubePage() {
  const { t } = useDashboardI18n();
  const useConfigs = (guildId: string) => useYouTubeConfigs(guildId);
  return (
    <IntegrationConfigPage<YoutubeVideoConfig>
      useConfigs={useConfigs}
      moduleTitle={t("provider.youtubeTitle")}
      moduleIcon={<YouTubeIcon color="error" />}
      moduleColor="#FF0000"
      moduleName="YouTube"
      provider="youtube"
      channelNameField="youtubeChannelId"
      channelNameLabel={t("provider.channelId")}
      channelNamePlaceholder="UCsBjURrPoezykLs9EqgamOA"
      renderChip={(config) => (config as any).lastVideoId ? {
        label: t("provider.lastVideo", { id: (config as any).lastVideoId }),
        color: "default",
        variant: "outlined"
      } : undefined}
    />
  );
}
