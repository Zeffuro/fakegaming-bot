"use client";
import React from "react";
import { AlternateEmail } from "@mui/icons-material";
import type { BlueskyPostConfig } from "@zeffuro/fakegaming-common";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { useBlueskyConfigs } from "@/components/hooks/useBluesky";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function GuildBlueskyPage() {
  const { t } = useDashboardI18n();
  const useConfigs = (guildId: string) => useBlueskyConfigs(guildId);
  return (
    <IntegrationConfigPage<BlueskyPostConfig>
      useConfigs={useConfigs}
      moduleTitle={t("provider.blueskyTitle")}
      moduleIcon={<AlternateEmail />}
      moduleColor={dashboardAccents.bluesky}
      moduleName="Bluesky"
      provider="bluesky"
      channelNameField="blueskyHandle"
      channelNameLabel={t("provider.handle")}
      channelNamePlaceholder="bsky.app"
      itemSingularLabel={t("provider.account")}
      itemPluralLabel={t("provider.accounts")}
    />
  );
}
