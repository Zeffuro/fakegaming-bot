import { useEffect, useState } from "react";
import type { BlueskyPostConfig } from "@zeffuro/fakegaming-common";
import { api, type BlueskyCreateRequest } from "@/lib/api-client";

function buildPayload(config: Omit<BlueskyPostConfig, 'id' | 'guildId'> | BlueskyPostConfig, guildId: string): BlueskyCreateRequest {
  return {
    blueskyHandle: String((config as any).blueskyHandle ?? '').trim().replace(/^@/, ''),
    discordChannelId: config.discordChannelId,
    guildId,
    customMessage: config.customMessage,
    cooldownMinutes: (config as any).cooldownMinutes ?? null,
    quietHoursStart: (config as any).quietHoursStart ? String((config as any).quietHoursStart) : null,
    quietHoursEnd: (config as any).quietHoursEnd ? String((config as any).quietHoursEnd) : null,
  };
}

export function useBlueskyConfigs(guildId: string | string[]) {
  const [configs, setConfigs] = useState<BlueskyPostConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const allConfigs = await api.getBlueskyConfigs();
      const guildConfigs = allConfigs.filter((config) => config.guildId === guildId);
      setConfigs(guildConfigs);
    } catch (err: any) {
      setError(err.message || 'Failed to load Bluesky configurations');
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async (configData: Omit<BlueskyPostConfig, 'id' | 'guildId'>) => {
    if (!(configData as any).blueskyHandle || !configData.discordChannelId) {
      setError('Bluesky handle and Discord Channel ID are required');
      return false;
    }

    try {
      setSaving(true);
      await api.createBlueskyAccount(buildPayload(configData, guildId as string));
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save Bluesky configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: BlueskyPostConfig) => {
    try {
      setSaving(true);
      await api.deleteBlueskyAccount(String((config as any).id));
      await api.createBlueskyAccount(buildPayload(config, guildId as string));
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update Bluesky configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (config: BlueskyPostConfig) => {
    try {
      setSaving(true);
      await api.deleteBlueskyAccount(String((config as any).id));
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete Bluesky configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeConfig = async (configId: string) => {
    try {
      setSaving(true);
      await api.deleteBlueskyAccount(configId);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete Bluesky configuration');
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
