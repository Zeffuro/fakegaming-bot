import { useState, useEffect } from "react";
import type { TwitchStreamConfig } from "@/lib/common/models";

export function useTwitchConfigs(guildId: string | string[]) {
  const [configs, setConfigs] = useState<TwitchStreamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/external/twitch', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Twitch configurations');
      }

      const allConfigs = await response.json();
      // Filter configs for current guild
      const guildConfigs = allConfigs.filter((config: TwitchStreamConfig) => config.guildId === guildId);
      setConfigs(guildConfigs);
    } catch (err: any) {
      setError(err.message || 'Failed to load Twitch configurations');
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async (configData: Omit<TwitchStreamConfig, 'id' | 'guildId'>) => {
    if (!configData.twitchUsername || !configData.discordChannelId) {
      setError('Twitch Channel Name and Discord Channel ID are required');
      return false;
    }

    try {
      setSaving(true);
      const payload = {
        twitchUsername: configData.twitchUsername,
        discordChannelId: configData.discordChannelId,
        guildId: guildId as string,
        customMessage: configData.customMessage
      };

      const response = await fetch('/api/external/twitch/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.status === 503) {
        const data = await response.json();
        throw new Error(data.error || 'Service temporarily unavailable. Please try again in a few moments.');
      }

      if (!response.ok) {
        throw new Error('Failed to add Twitch configuration');
      }

      setError(null);
      await fetchConfigs(); // Refresh the list
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to add Twitch configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: TwitchStreamConfig) => {
    try {
      setSaving(true);
      const response = await fetch('/api/external/twitch/stream', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to update Twitch configuration');
      }

      setError(null);
      await fetchConfigs(); // Refresh the list
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update Twitch configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (config: TwitchStreamConfig) => {
    try {
      setSaving(true);

      if (!config.id) {
        throw new Error('Configuration ID is required for deletion');
      }

      const response = await fetch(`/api/external/twitch/stream/${config.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete Twitch configuration');
      }

      setError(null);
      await fetchConfigs(); // Refresh the list
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete Twitch configuration');
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
