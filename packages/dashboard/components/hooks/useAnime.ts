import { useEffect, useState } from "react";
import { api, type AnimeSubscriptionDashboardConfig } from "@/lib/api-client";

export type AnimeDashboardConfig = AnimeSubscriptionDashboardConfig & {
  animeTitle: string;
  discordChannelId: string;
  customMessage?: string;
  cooldownMinutes?: number | null;
};

export function useAnimeConfigs(guildId: string | string[]) {
  const [configs, setConfigs] = useState<AnimeDashboardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const allConfigs = await api.getAnimeSubscriptions(guildId as string);
      setConfigs(allConfigs.map((config) => ({
        ...config,
        discordChannelId: config.channelId ?? config.discordChannelId,
        cooldownMinutes: config.reminderMinutes,
      })));
    } catch (err: any) {
      setError(err.message || 'Failed to load anime subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async (configData: Omit<AnimeDashboardConfig, 'id' | 'guildId'>) => {
    const titleOrId = String(configData.animeTitle ?? '').trim();
    if (!titleOrId || !configData.discordChannelId) {
      setError('Anime title/AniList ID and Discord Channel are required');
      return false;
    }

    try {
      setSaving(true);
      const numericId = Number(titleOrId);
      await api.createAnimeSubscription({
        ...(Number.isInteger(numericId) && numericId > 0 ? { anilistId: numericId } : { title: titleOrId }),
        guildId: guildId as string,
        channelId: configData.discordChannelId,
        reminderMinutes: (configData as any).cooldownMinutes ?? configData.reminderMinutes ?? 30,
      });
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save anime subscription');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: AnimeDashboardConfig) => {
    try {
      setSaving(true);
      if (config.id) {
        await api.deleteAnimeSubscription(config.id);
      }
      await api.createAnimeSubscription({
        anilistId: config.anilistId,
        guildId: guildId as string,
        channelId: config.discordChannelId,
        reminderMinutes: (config as any).cooldownMinutes ?? config.reminderMinutes ?? 30,
      });
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update anime subscription');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (config: AnimeDashboardConfig) => {
    if (!config.id) return false;
    try {
      setSaving(true);
      await api.deleteAnimeSubscription(config.id);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete anime subscription');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (guildId) {
      void fetchConfigs();
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
    refreshConfigs: fetchConfigs,
  };
}
