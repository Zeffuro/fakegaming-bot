import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";

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
  const enabled = options.enabled ?? true;
  const [configs, setConfigs] = useState<YouTubeDashboardConfig[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    if (!enabled || !guildId) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allConfigs = await api.getYouTubeConfigs(guildId as string);

      const guildConfigs = allConfigs.filter((config: any) => config.guildId === guildId) as YouTubeConfig[];
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

      setConfigs(guildConfigs.map((config) => {
        const meta = metadataByChannelId.get(config.youtubeChannelId);
        return {
          ...config,
          ...(meta?.title ? { youtubeChannelTitle: meta.title } : {}),
          ...(meta?.url ? { youtubeChannelUrl: meta.url } : {}),
        };
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to load YouTube configurations');
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async (configData: Omit<YouTubeConfig, 'id' | 'guildId'>) => {
    if (!configData.youtubeChannelId || !configData.discordChannelId) {
      setError('YouTube Channel ID and Discord Channel ID are required');
      return false;
    }

    try {
      setSaving(true);
      const payload = {
        youtubeChannelId: configData.youtubeChannelId,
        discordChannelId: configData.discordChannelId,
        guildId: guildId as string,
        customMessage: configData.customMessage,
        cooldownMinutes: (configData as any).cooldownMinutes ?? null,
        quietHoursStart: (configData as any).quietHoursStart ? String((configData as any).quietHoursStart) : null,
        quietHoursEnd: (configData as any).quietHoursEnd ? String((configData as any).quietHoursEnd) : null,
      };

      await api.createYouTubeChannel(payload as unknown as YouTubeCreateRequest);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save YouTube configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: YouTubeDashboardConfig) => {
    try {
      setSaving(true);
      const payload = {
        youtubeChannelId: config.youtubeChannelId,
        discordChannelId: config.discordChannelId,
        guildId: guildId as string,
        customMessage: config.customMessage,
        cooldownMinutes: (config as any).cooldownMinutes ?? null,
        quietHoursStart: (config as any).quietHoursStart ? String((config as any).quietHoursStart) : null,
        quietHoursEnd: (config as any).quietHoursEnd ? String((config as any).quietHoursEnd) : null,
      };

      await api.deleteYouTubeChannel(config.id.toString());
      await api.createYouTubeChannel(payload as unknown as YouTubeCreateRequest);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update YouTube configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (config: YouTubeDashboardConfig) => {
    try {
      setSaving(true);
      await api.deleteYouTubeChannel(config.id.toString());
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete YouTube configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeConfig = async (configId: string) => {
    try {
      setSaving(true);
      await api.deleteYouTubeChannel(configId);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete YouTube configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!enabled || !guildId) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    void fetchConfigs();
  }, [enabled, guildId]);

  return {
    configs,
    loading,
    error,
    saving,
    setError,
    addConfig,
    updateConfig,
    deleteConfig,
    removeConfig,
    refreshConfigs: fetchConfigs
  };
}
