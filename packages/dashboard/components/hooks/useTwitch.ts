import { useState, useEffect } from "react";
import type { TwitchStreamConfig } from "@zeffuro/fakegaming-common";
import { api } from "@/lib/api-client";
import type { twitch_post_Request } from "@zeffuro/fakegaming-common/api-responses";

export function useTwitchConfigs(guildId: string | string[]) {
  const [configs, setConfigs] = useState<TwitchStreamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const allConfigs = await api.getTwitchConfigs();

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
        customMessage: configData.customMessage,
        cooldownMinutes: (configData as any).cooldownMinutes ?? null,
        quietHoursStart: (configData as any).quietHoursStart ? String((configData as any).quietHoursStart) : null,
        quietHoursEnd: (configData as any).quietHoursEnd ? String((configData as any).quietHoursEnd) : null,
      };

      await api.createTwitchStream(payload as unknown as twitch_post_Request);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save Twitch configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: TwitchStreamConfig) => {
    try {
      setSaving(true);
      const payload = {
        twitchUsername: config.twitchUsername,
        discordChannelId: config.discordChannelId,
        guildId: guildId as string,
        customMessage: config.customMessage,
        cooldownMinutes: (config as any).cooldownMinutes ?? null,
        quietHoursStart: (config as any).quietHoursStart ? String((config as any).quietHoursStart) : null,
        quietHoursEnd: (config as any).quietHoursEnd ? String((config as any).quietHoursEnd) : null,
      };

      await api.deleteTwitchStream(config.id.toString());
      await api.createTwitchStream(payload as unknown as twitch_post_Request);
      await fetchConfigs();
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
