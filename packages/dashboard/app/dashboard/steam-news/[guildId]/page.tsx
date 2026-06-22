"use client";
import React from "react";
import { SportsEsports } from "@mui/icons-material";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { searchSteamNewsAppOptions, useSteamNewsConfigs, type SteamNewsDashboardConfig } from "@/components/hooks/useSteamNews";

export default function GuildSteamNewsPage() {
    const useConfigs = (guildId: string) => useSteamNewsConfigs(guildId);

    return (
        <IntegrationConfigPage<SteamNewsDashboardConfig>
            useConfigs={useConfigs}
            moduleTitle="Steam News Subscriptions"
            moduleIcon={<SportsEsports />}
            moduleColor={dashboardAccents.steam}
            moduleName="Steam News"
            provider="steamnews"
            channelNameField="steamAppId"
            channelNameLabel="Game, App ID, or Steam URL"
            channelNamePlaceholder="Counter-Strike 2 or https://store.steampowered.com/app/730/..."
            itemSingularLabel="Game Subscription"
            itemPluralLabel="Game Subscriptions"
            itemNameSearch={searchSteamNewsAppOptions}
            renderChip={(config) => {
                if (!config.lastAnnouncedAt) return undefined;
                const parsed = new Date(config.lastAnnouncedAt);
                return {
                    label: Number.isNaN(parsed.getTime()) ? "Last announcement saved" : `Last: ${parsed.toLocaleDateString()}`,
                    color: "info",
                    variant: "outlined",
                };
            }}
        />
    );
}
