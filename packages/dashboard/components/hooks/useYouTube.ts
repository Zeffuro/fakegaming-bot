import { useState, useEffect } from "react";
import type { YoutubeVideoConfig } from "@/lib/common/models";

export function useYouTubeConfigs(guildId: string | string[]) {
  const [configs, setConfigs] = useState<YoutubeVideoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/external/youtube', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch YouTube configurations');
      }

      const allConfigs = await response.json();
      // Filter configs for current guild
      const guildConfigs = allConfigs.filter((config: YoutubeVideoConfig) => config.guildId === guildId);
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

      const response = await fetch('/api/external/youtube/channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to add YouTube configuration');
      }

      setError(null);
      await fetchConfigs(); // Refresh the list
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to add YouTube configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: YoutubeVideoConfig) => {
    try {
      setSaving(true);
      const response = await fetch('/api/external/youtube/channel', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to update YouTube configuration');
      }

      setError(null);
      await fetchConfigs(); // Refresh the list
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

      if (!config.id) {
        throw new Error('Configuration ID is required for deletion');
      }

      const response = await fetch(`/api/external/youtube/channel/${config.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete YouTube configuration');
      }

      setError(null);
      await fetchConfigs(); // Refresh the list
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
    saving,
    error,
    setError,
    addConfig,
    updateConfig,
    deleteConfig,
    refetch: fetchConfigs
  };
}
