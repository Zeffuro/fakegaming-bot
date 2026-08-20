import type { BlueskyPostConfig } from "@zeffuro/fakegaming-common";
import { api, type BlueskyCreateRequest } from "@/lib/api-client";
import { buildNotificationTimingPayload, useConfigResource } from "@/components/hooks/useConfigResource";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

type BlueskyUpdateRequest = Parameters<typeof api.updateBlueskyAccount>[1];

function buildPayload(config: Omit<BlueskyPostConfig, 'id' | 'guildId'> | BlueskyPostConfig, guildId: string): BlueskyCreateRequest {
  return {
    blueskyHandle: String((config as any).blueskyHandle ?? '').trim().replace(/^@/, ''),
    discordChannelId: config.discordChannelId,
    guildId,
    ...buildNotificationTimingPayload(config),
  };
}

interface UseBlueskyConfigsOptions {
  enabled?: boolean;
}

export function useBlueskyConfigs(guildId: string | string[], options: UseBlueskyConfigsOptions = {}) {
  const { t } = useDashboardI18n();
  return useConfigResource<BlueskyPostConfig, Omit<BlueskyPostConfig, 'id' | 'guildId'>>({
    guildId,
    enabled: options.enabled ?? true,
    load: async (resolvedGuildId) => {
      const allConfigs = await api.getBlueskyConfigs(resolvedGuildId);
      return allConfigs.filter((config: BlueskyPostConfig) => config.guildId === resolvedGuildId);
    },
    create: async (configData, resolvedGuildId) => {
      await api.createBlueskyAccount(buildPayload(configData, resolvedGuildId));
    },
    update: async (config, resolvedGuildId) => {
      await api.deleteBlueskyAccount(String(config.id));
      await api.createBlueskyAccount(buildPayload(config, resolvedGuildId));
    },
    setPaused: async (config, paused) => {
      const body = { paused } satisfies BlueskyUpdateRequest;
      await api.updateBlueskyAccount(config.id, body);
    },
    deleteConfig: async (config) => {
      await api.deleteBlueskyAccount(String(config.id));
    },
    removeById: async (configId) => {
      await api.deleteBlueskyAccount(configId);
    },
    validateCreate: (configData) => (
      configData.blueskyHandle && configData.discordChannelId
        ? null
        : t("hooks.blueskyRequired")
    ),
    messages: {
      loadFailed: t("hooks.blueskyLoadFailed"),
      createFailed: t("hooks.blueskySaveFailed"),
      updateFailed: t("hooks.blueskyUpdateFailed"),
      deleteFailed: t("hooks.blueskyDeleteFailed"),
    }
  });
}
