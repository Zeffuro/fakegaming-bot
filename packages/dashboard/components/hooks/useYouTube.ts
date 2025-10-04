import { useState, useEffect } from "react";
import type { YoutubeVideoConfig } from "@/lib/common/models";
import { api } from "@/lib/api-client";
import type { youtube_post_Request } from "@/types/apiResponses";

export function useYouTubeConfigs(guildId: string | string[]) {
  const [configs, setConfigs] = useState<YoutubeVideoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const allConfigs = await api.getYouTubeConfigs();

      const guildConfigs = allConfigs.filter((config: any) => config.guildId === guildId) as YoutubeVideoConfig[];
      setConfigs(guildConfigs);
    } catch (err: any) {
      setError(err.message || 'Failed to load YouTube configurations');
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async (configData: Omit<YoutubeVideoConfig, 'id' | 'guildId'>) => {
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
        customMessage: configData.customMessage
      };

      await api.createYouTubeChannel(payload as youtube_post_Request);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save YouTube configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: YoutubeVideoConfig) => {
    try {
      setSaving(true);
      const payload = {
        youtubeChannelId: config.youtubeChannelId,
        discordChannelId: config.discordChannelId,
        guildId: guildId as string,
        customMessage: config.customMessage
      };

      await api.deleteYouTubeChannel(config.id.toString());
      await api.createYouTubeChannel(payload as youtube_post_Request);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update YouTube configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (config: YoutubeVideoConfig) => {
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
    if (guildId) {
      fetchConfigs();
    }
  }, [guildId]);

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
