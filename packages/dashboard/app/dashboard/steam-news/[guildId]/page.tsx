"use client";
import React from "react";
import { SportsEsports } from "@mui/icons-material";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { searchSteamNewsAppOptions, useSteamNewsConfigs, type SteamNewsDashboardConfig } from "@/components/hooks/useSteamNews";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function GuildSteamNewsPage() {
    const { t, formatDate } = useDashboardI18n();
    const useConfigs = (guildId: string) => useSteamNewsConfigs(guildId);

    return (
        <IntegrationConfigPage<SteamNewsDashboardConfig>
            useConfigs={useConfigs}
            moduleTitle={t("provider.steamTitle")}
            moduleIcon={<SportsEsports />}
            moduleColor={dashboardAccents.steam}
            moduleName="Steam News"
            provider="steamnews"
            channelNameField="steamAppId"
            channelNameLabel={t("provider.gameAppOrUrl")}
            channelNamePlaceholder="Counter-Strike 2 or https://store.steampowered.com/app/730/..."
            itemSingularLabel={t("provider.gameSubscription")}
            itemPluralLabel={t("provider.gameSubscriptions")}
            itemNameSearch={searchSteamNewsAppOptions}
            renderChip={(config) => {
                if (!config.lastAnnouncedAt) return undefined;
                const parsed = new Date(config.lastAnnouncedAt);
                return {
                    label: Number.isNaN(parsed.getTime())
                        ? t("provider.lastAnnouncementSaved")
                        : t("provider.lastAnnouncement", { date: formatDate(parsed, { dateStyle: "medium" }) }),
                    color: "info",
                    variant: "outlined",
                };
            }}
        />
    );
}
