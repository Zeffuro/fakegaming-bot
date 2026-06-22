import { useState, useEffect, useCallback } from "react";
import type { PatchSubscriptionConfig } from "@zeffuro/fakegaming-common";
import { api } from "@/lib/api-client";

type PatchSubscriptionCreateRequest = Parameters<typeof api.createPatchSubscription>[0];
type PatchSubscriptionUpsertRequest = Parameters<typeof api.upsertPatchSubscription>[0];

interface UsePatchSubscriptionsOptions {
  enabled?: boolean;
}

export interface PatchSubscriptionUIConfig {
  id: number;
  game: string;
  guildId: string;
  discordChannelId: string;
  customMessage?: string;
  paused?: boolean | null;
}

export function usePatchSubscriptions(guildId: string | string[], options: UsePatchSubscriptionsOptions = {}) {
  const enabled = options.enabled ?? true;
  const [configs, setConfigs] = useState<PatchSubscriptionUIConfig[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapToUI = (sub: PatchSubscriptionConfig): PatchSubscriptionUIConfig => ({
    id: sub.id!,
    game: sub.game,
    guildId: sub.guildId,
    discordChannelId: sub.channelId,
    paused: sub.paused,
  });

  const fetchConfigs = useCallback(async () => {
    if (!enabled || !guildId) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const all = await api.getPatchSubscriptions(guildId as string);
      const guildSubs = (all as PatchSubscriptionConfig[]).filter(s => s.guildId === guildId);
      setConfigs(guildSubs.map(mapToUI));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load Patch Note subscriptions");
    } finally {
      setLoading(false);
    }
  }, [enabled, guildId]);

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
        paused: Boolean(config.paused),
      } as unknown as PatchSubscriptionCreateRequest;
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
        paused: Boolean(config.paused),
      } as unknown as PatchSubscriptionUpsertRequest;
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

  const togglePausedConfig = async (config: PatchSubscriptionUIConfig) => {
    try {
      setSaving(true);
      await api.setPatchSubscriptionPaused(config.id, !config.paused);
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update subscription status');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setAllPausedConfigs = async (paused: boolean) => {
    const targets = configs.filter((config) => Boolean(config.id) && Boolean(config.paused) !== paused);
    if (targets.length === 0) {
      return true;
    }

    try {
      setSaving(true);
      await Promise.all(targets.map((config) => api.setPatchSubscriptionPaused(config.id, paused)));
      await fetchConfigs();
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update subscription statuses');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!enabled || !guildId) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    void fetchConfigs();
  }, [enabled, guildId, fetchConfigs]);

  return {
    configs,
    loading,
    saving,
    error,
    setError,
    addConfig,
    updateConfig,
    deleteConfig,
    togglePausedConfig,
    setAllPausedConfigs,
    refreshConfigs: fetchConfigs
  };
}
