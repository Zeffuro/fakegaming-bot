import { useEffect, useState } from "react";
import { api, type AnimeSubscriptionDashboardConfig } from "@/lib/api-client";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export type AnimeDashboardConfig = AnimeSubscriptionDashboardConfig & {
  animeTitle: string;
  discordChannelId: string;
  customMessage?: string;
  cooldownMinutes?: number | null;
};

interface UseAnimeConfigsOptions {
  enabled?: boolean;
}

export function useAnimeConfigs(guildId: string | string[], options: UseAnimeConfigsOptions = {}) {
  const { t } = useDashboardI18n();
  const enabled = options.enabled ?? true;
  const [configs, setConfigs] = useState<AnimeDashboardConfig[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    if (!enabled || !guildId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allConfigs = await api.getAnimeSubscriptions(guildId as string);
      setConfigs(allConfigs.map((config) => ({
        ...config,
        discordChannelId: config.channelId ?? config.discordChannelId,
        cooldownMinutes: config.reminderMinutes,
      })));
    } catch (err: any) {
      setError(err.message || t("hooks.failedToLoadAnimeSubscriptions"));
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async (configData: Omit<AnimeDashboardConfig, 'id' | 'guildId'>) => {
    const titleOrId = String(configData.animeTitle ?? '').trim();
    if (!titleOrId || !configData.discordChannelId) {
      setError(t("hooks.animeSubscriptionRequired"));
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
      setError(err.message || t("hooks.failedToCreateAnimeSubscription"));
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
      setError(err.message || t("hooks.failedToUpdateAnimeSubscription"));
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
      setError(err.message || t("hooks.failedToDeleteAnimeSubscription"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!enabled || !guildId) {
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
    refreshConfigs: fetchConfigs,
  };
}
