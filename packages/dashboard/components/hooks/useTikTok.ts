import { useState, useEffect } from "react";
import type { TikTokStreamConfig } from "@zeffuro/fakegaming-common";
import { api } from "@/lib/api-client";

export function useTikTokConfigs(guildId: string | string[]) {
  const [configs, setConfigs] = useState<TikTokStreamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const allConfigs = await api.getTikTokConfigs();
      const guildConfigs = allConfigs.filter((config: any) => config.guildId === guildId) as TikTokStreamConfig[];
      setConfigs(guildConfigs);
    } catch (err: any) {
      setError(err.message || 'Failed to load TikTok configurations');
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async (configData: Omit<TikTokStreamConfig, 'id' | 'guildId'>) => {
    if (!(configData as any).tiktokUsername || !configData.discordChannelId) {
      setError('TikTok Channel Name and Discord Channel ID are required');
      return false;
    }

    try {
      setSaving(true);
      const payload = {
        tiktokUsername: (configData as any).tiktokUsername,
        discordChannelId: configData.discordChannelId,
        guildId: guildId as string,
        customMessage: configData.customMessage,
        cooldownMinutes: (configData as any).cooldownMinutes ?? null,
        quietHoursStart: (configData as any).quietHoursStart ? String((configData as any).quietHoursStart) : null,
        quietHoursEnd: (configData as any).quietHoursEnd ? String((configData as any).quietHoursEnd) : null,
      };

      await api.createTikTokStream(payload as any);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save TikTok configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: TikTokStreamConfig) => {
    try {
      setSaving(true);
      const payload = {
        tiktokUsername: (config as any).tiktokUsername,
        discordChannelId: config.discordChannelId,
        guildId: guildId as string,
        customMessage: config.customMessage,
        cooldownMinutes: (config as any).cooldownMinutes ?? null,
        quietHoursStart: (config as any).quietHoursStart ? String((config as any).quietHoursStart) : null,
        quietHoursEnd: (config as any).quietHoursEnd ? String((config as any).quietHoursEnd) : null,
      };

      await api.deleteTikTokStream(String((config as any).id));
      await api.createTikTokStream(payload as any);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update TikTok configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (config: TikTokStreamConfig) => {
    try {
      setSaving(true);
      await api.deleteTikTokStream(String((config as any).id));
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete TikTok configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeConfig = async (configId: string) => {
    try {
      setSaving(true);
      await api.deleteTikTokStream(configId);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete TikTok configuration');
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

