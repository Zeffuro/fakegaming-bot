import { useState, useEffect } from "react";
import type { TwitchStreamConfig } from "@/lib/common/models";
import { api } from "@/lib/api-client";
import type { twitch_post_Request } from "@/types/apiResponses";

export function useTwitchConfigs(guildId: string | string[]) {
  const [configs, setConfigs] = useState<TwitchStreamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const allConfigs = await api.getTwitchConfigs();

      // Filter configs for current guild and cast to Sequelize types
      const guildConfigs = allConfigs.filter((config: any) => config.guildId === guildId) as TwitchStreamConfig[];
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

      await api.createTwitchStream(payload as twitch_post_Request);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save Twitch configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Match the expected signature: (config: T) => Promise<boolean>
  const updateConfig = async (config: TwitchStreamConfig) => {
    try {
      setSaving(true);
      const payload = {
        twitchUsername: config.twitchUsername,
        discordChannelId: config.discordChannelId,
        guildId: guildId as string,
        customMessage: config.customMessage
      };

      // For now, we'll use a workaround since the update endpoint might not exist
      await api.deleteTwitchStream(config.id.toString());
      await api.createTwitchStream(payload as twitch_post_Request);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update Twitch configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Match the expected signature: (config: T) => Promise<boolean>
  const deleteConfig = async (config: TwitchStreamConfig) => {
    try {
      setSaving(true);
      await api.deleteTwitchStream(config.id.toString());
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete Twitch configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeConfig = async (configId: string) => {
    try {
      setSaving(true);
      await api.deleteTwitchStream(configId);
      await fetchConfigs();
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
