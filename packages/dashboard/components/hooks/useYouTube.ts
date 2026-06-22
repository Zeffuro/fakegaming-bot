import { api } from "@/lib/api-client";
import { buildNotificationTimingPayload, useConfigResource } from "@/components/hooks/useConfigResource";

type YouTubeConfig = Awaited<ReturnType<typeof api.getYouTubeConfigs>>[number] & {
  youtubeChannelId: string;
  discordChannelId: string;
  guildId: string;
};
type YouTubeCreateRequest = Parameters<typeof api.createYouTubeChannel>[0];

type YouTubeDashboardConfig = YouTubeConfig & {
  youtubeChannelTitle?: string;
  youtubeChannelUrl?: string | null;
};
type YouTubeChannelMetadata = Awaited<ReturnType<typeof api.getYouTubeChannelMetadata>>;
type YouTubeUpdateRequest = Parameters<typeof api.updateYouTubeChannel>[1];

interface UseYouTubeConfigsOptions {
  enabled?: boolean;
}

const channelMetadataCache = new Map<string, Promise<YouTubeChannelMetadata>>();

async function getCachedYouTubeChannelMetadata(channelId: string): Promise<YouTubeChannelMetadata> {
  const cached = channelMetadataCache.get(channelId);
  if (cached) return cached;

  const pending = api.getYouTubeChannelMetadata(channelId).catch((err: unknown) => {
    channelMetadataCache.delete(channelId);
    throw err;
  });
  channelMetadataCache.set(channelId, pending);
  return pending;
}

export function useYouTubeConfigs(guildId: string | string[], options: UseYouTubeConfigsOptions = {}) {
  return useConfigResource<YouTubeDashboardConfig, Omit<YouTubeConfig, 'id' | 'guildId'>>({
    guildId,
    enabled: options.enabled ?? true,
    load: async (resolvedGuildId) => {
      const allConfigs = await api.getYouTubeConfigs(resolvedGuildId);
      const guildConfigs = allConfigs.filter((config: YouTubeConfig) => config.guildId === resolvedGuildId) as YouTubeConfig[];
      const uniqueChannelIds = [...new Set(guildConfigs.map((config) => config.youtubeChannelId).filter(Boolean))];
      const metadata = await Promise.allSettled(uniqueChannelIds.map(async (channelId) => {
        const data = await getCachedYouTubeChannelMetadata(channelId);
        return [channelId, data] as const;
      }));
      const metadataByChannelId = new Map<string, YouTubeChannelMetadata>();
      for (const result of metadata) {
        if (result.status === 'fulfilled') {
          const [channelId, data] = result.value;
          metadataByChannelId.set(channelId, data);
        }
      }

      return guildConfigs.map((config) => {
        const meta = metadataByChannelId.get(config.youtubeChannelId);
        return {
          ...config,
          ...(meta?.title ? { youtubeChannelTitle: meta.title } : {}),
          ...(meta?.url ? { youtubeChannelUrl: meta.url } : {}),
        };
      });
    },
    create: async (configData, resolvedGuildId) => {
      await api.createYouTubeChannel({
        youtubeChannelId: configData.youtubeChannelId,
        discordChannelId: configData.discordChannelId,
        guildId: resolvedGuildId,
        ...buildNotificationTimingPayload(configData),
      } as unknown as YouTubeCreateRequest);
    },
    update: async (config, resolvedGuildId) => {
      await api.deleteYouTubeChannel(config.id.toString());
      await api.createYouTubeChannel({
        youtubeChannelId: config.youtubeChannelId,
        discordChannelId: config.discordChannelId,
        guildId: resolvedGuildId,
        ...buildNotificationTimingPayload(config),
      } as unknown as YouTubeCreateRequest);
    },
    setPaused: async (config, paused) => {
      const body = { paused } satisfies YouTubeUpdateRequest;
      await api.updateYouTubeChannel(config.id, body);
    },
    deleteConfig: async (config) => {
      await api.deleteYouTubeChannel(config.id.toString());
    },
    removeById: async (configId) => {
      await api.deleteYouTubeChannel(configId);
    },
    validateCreate: (configData) => (
      configData.youtubeChannelId && configData.discordChannelId
        ? null
        : 'YouTube Channel ID and Discord Channel ID are required'
    ),
    messages: {
      loadFailed: 'Failed to load YouTube configurations',
      createFailed: 'Failed to save YouTube configuration',
      updateFailed: 'Failed to update YouTube configuration',
      deleteFailed: 'Failed to delete YouTube configuration',
    }
  });
}
