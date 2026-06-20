import type { TwitchStreamConfig } from "@zeffuro/fakegaming-common";
import { api } from "@/lib/api-client";
import { buildNotificationTimingPayload, useConfigResource } from "@/components/hooks/useConfigResource";

type TwitchCreateRequest = Parameters<typeof api.createTwitchStream>[0];

interface UseTwitchConfigsOptions {
  enabled?: boolean;
}

export function useTwitchConfigs(guildId: string | string[], options: UseTwitchConfigsOptions = {}) {
  return useConfigResource<TwitchStreamConfig, Omit<TwitchStreamConfig, 'id' | 'guildId'>>({
    guildId,
    enabled: options.enabled ?? true,
    load: async (resolvedGuildId) => {
      const allConfigs = await api.getTwitchConfigs(resolvedGuildId);
      return allConfigs.filter((config: TwitchStreamConfig) => config.guildId === resolvedGuildId) as TwitchStreamConfig[];
    },
    create: async (configData, resolvedGuildId) => {
      await api.createTwitchStream({
        twitchUsername: configData.twitchUsername,
        discordChannelId: configData.discordChannelId,
        guildId: resolvedGuildId,
        ...buildNotificationTimingPayload(configData),
      } as unknown as TwitchCreateRequest);
    },
    update: async (config, resolvedGuildId) => {
      await api.deleteTwitchStream(config.id.toString());
      await api.createTwitchStream({
        twitchUsername: config.twitchUsername,
        discordChannelId: config.discordChannelId,
        guildId: resolvedGuildId,
        ...buildNotificationTimingPayload(config),
      } as unknown as TwitchCreateRequest);
    },
    deleteConfig: async (config) => {
      await api.deleteTwitchStream(config.id.toString());
    },
    removeById: async (configId) => {
      await api.deleteTwitchStream(configId);
    },
    validateCreate: (configData) => (
      configData.twitchUsername && configData.discordChannelId
        ? null
        : 'Twitch Channel Name and Discord Channel ID are required'
    ),
    messages: {
      loadFailed: 'Failed to load Twitch configurations',
      createFailed: 'Failed to save Twitch configuration',
      updateFailed: 'Failed to update Twitch configuration',
      deleteFailed: 'Failed to delete Twitch configuration',
    }
  });
}
