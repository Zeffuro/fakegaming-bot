"use client";
import React from "react";
import { SpeakerNotes } from "@mui/icons-material";
import type { PatchSubscriptionUIConfig } from "@/components/hooks/usePatchSubscriptions";
import { IntegrationConfigPage } from "@/components/IntegrationConfigPage";
import { usePatchSubscriptions } from "@/components/hooks/usePatchSubscriptions";
import { useSupportedGames } from "@/components/hooks/useSupportedGames";
import { useLatestPatchNotes } from "@/components/hooks/useLatestPatchNotes";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";

export default function GuildPatchNotesPage() {
  const { guildId } = useGuildFromParams();
  const configsApi = usePatchSubscriptions(guildId as string);
  const { games } = useSupportedGames();
  const { latestByGame } = useLatestPatchNotes(configsApi.configs);

  return (
    <IntegrationConfigPage<PatchSubscriptionUIConfig>
      useConfigs={usePatchSubscriptions as unknown as (guildId: string) => any}
      configsApi={configsApi as any}
      moduleTitle="Patch Note Subscriptions"
      moduleIcon={<SpeakerNotes color="secondary" />}
      moduleColor="#7C4DFF"
      moduleName="Patch Notes"
      channelNameField="game"
      channelNameLabel="Game"
      channelNamePlaceholder="League of Legends"
      showCustomMessage={false}
      itemSingularLabel="Game Subscription"
      itemPluralLabel="Game Subscriptions"
      itemNameOptions={games}
      allowEdit={false}
      renderChip={(cfg) => {
        const info = (latestByGame as Record<string, { version?: string }>)[(cfg as any).game];
        if (!info) return undefined;
        const label = info.version ? `Latest: ${info.version}` : 'Latest patch';
        return { label, color: 'info', variant: 'outlined' };
      }}
    />
  );
}
