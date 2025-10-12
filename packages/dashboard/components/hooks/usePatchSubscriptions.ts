import { useState, useEffect, useCallback } from "react";
import type { PatchSubscriptionConfig } from "@zeffuro/fakegaming-common";
import { api } from "@/lib/api-client";
import type { patchSubscriptions_post_Request } from "@/types/apiResponses";

export interface PatchSubscriptionUIConfig {
  id: number;
  game: string;
  guildId: string;
  discordChannelId: string;
  customMessage?: string;
}

export function usePatchSubscriptions(guildId: string | string[]) {
  const [configs, setConfigs] = useState<PatchSubscriptionUIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapToUI = (sub: PatchSubscriptionConfig): PatchSubscriptionUIConfig => ({
    id: sub.id!,
    game: sub.game,
    guildId: sub.guildId,
    discordChannelId: sub.channelId,
  });

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const all = await api.getPatchSubscriptions();
      const guildSubs = (all as PatchSubscriptionConfig[]).filter(s => s.guildId === guildId);
      setConfigs(guildSubs.map(mapToUI));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load Patch Note subscriptions");
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  const addConfig = async (config: Omit<PatchSubscriptionUIConfig, 'id' | 'guildId'>) => {
    if (!config.game || !config.discordChannelId) {
      setError('Game and Discord Channel are required');
      return false;
    }

    try {
      setSaving(true);
      const payload = {
        game: config.game,
        channelId: config.discordChannelId,
        guildId: guildId as string,
      } as unknown as patchSubscriptions_post_Request;
      await api.createPatchSubscription(payload);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create subscription');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (config: PatchSubscriptionUIConfig) => {
    try {
      setSaving(true);
      const payload = {
        game: config.game,
        channelId: config.discordChannelId,
        guildId: guildId as string,
      } as unknown as patchSubscriptions_post_Request;
      await api.upsertPatchSubscription(payload);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update subscription');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (config: PatchSubscriptionUIConfig) => {
    try {
      setSaving(true);
      await api.deletePatchSubscription(config.id);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to delete subscription');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (guildId) void fetchConfigs();
  }, [guildId, fetchConfigs]);

  return {
    configs,
    loading,
    saving,
    error,
    setError,
    addConfig,
    updateConfig,
    deleteConfig,
    refreshConfigs: fetchConfigs
  };
}
