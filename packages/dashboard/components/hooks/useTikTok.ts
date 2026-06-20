import type { TikTokStreamConfig } from "@zeffuro/fakegaming-common";
import { api } from "@/lib/api-client";
import { buildNotificationTimingPayload, useConfigResource } from "@/components/hooks/useConfigResource";

interface UseTikTokConfigsOptions {
  enabled?: boolean;
}

export function useTikTokConfigs(guildId: string | string[], options: UseTikTokConfigsOptions = {}) {
  return useConfigResource<TikTokStreamConfig, Omit<TikTokStreamConfig, 'id' | 'guildId'>>({
    guildId,
    enabled: options.enabled ?? true,
    load: async (resolvedGuildId) => {
      const allConfigs = await api.getTikTokConfigs(resolvedGuildId);
      return allConfigs.filter((config: TikTokStreamConfig) => config.guildId === resolvedGuildId) as TikTokStreamConfig[];
    },
    create: async (configData, resolvedGuildId) => {
      await api.createTikTokStream({
        tiktokUsername: configData.tiktokUsername,
        discordChannelId: configData.discordChannelId,
        guildId: resolvedGuildId,
        ...buildNotificationTimingPayload(configData),
      });
    },
    update: async (config, resolvedGuildId) => {
      await api.deleteTikTokStream(String(config.id));
      await api.createTikTokStream({
        tiktokUsername: config.tiktokUsername,
        discordChannelId: config.discordChannelId,
        guildId: resolvedGuildId,
        ...buildNotificationTimingPayload(config),
      });
    },
    deleteConfig: async (config) => {
      await api.deleteTikTokStream(String(config.id));
    },
    removeById: async (configId) => {
      await api.deleteTikTokStream(configId);
    },
    validateCreate: (configData) => (
      configData.tiktokUsername && configData.discordChannelId
        ? null
        : 'TikTok Channel Name and Discord Channel ID are required'
    ),
    messages: {
      loadFailed: 'Failed to load TikTok configurations',
      createFailed: 'Failed to save TikTok configuration',
      updateFailed: 'Failed to update TikTok configuration',
      deleteFailed: 'Failed to delete TikTok configuration',
    }
  });
}

