import type { TwitchStreamConfig } from "@zeffuro/fakegaming-common";
import { api } from "@/lib/api-client";
import { buildNotificationTimingPayload, useConfigResource } from "@/components/hooks/useConfigResource";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

type TwitchCreateRequest = Parameters<typeof api.createTwitchStream>[0];
type TwitchUpdateRequest = Parameters<typeof api.updateTwitchStream>[1];

interface UseTwitchConfigsOptions {
  enabled?: boolean;
}

export function useTwitchConfigs(guildId: string | string[], options: UseTwitchConfigsOptions = {}) {
  const { t } = useDashboardI18n();
  return useConfigResource<TwitchStreamConfig, Omit<TwitchStreamConfig, 'id' | 'guildId'>>({
    guildId,
    enabled: options.enabled ?? true,
    load: async (resolvedGuildId) => {
      const allConfigs = await api.getTwitchConfigs(resolvedGuildId);
      return allConfigs.filter((config: TwitchStreamConfig) => config.guildId === resolvedGuildId) as TwitchStreamConfig[];
    },
    create: async (configData, resolvedGuildId) => {
      await api.createTwitchStream({
        twitchUsername: configData.twitchUsername,
        discordChannelId: configData.discordChannelId,
        guildId: resolvedGuildId,
        ...buildNotificationTimingPayload(configData),
      } as unknown as TwitchCreateRequest);
    },
    update: async (config, resolvedGuildId) => {
      await api.updateTwitchStream(config.id, {
        twitchUsername: config.twitchUsername,
        discordChannelId: config.discordChannelId,
        guildId: resolvedGuildId,
        ...buildNotificationTimingPayload(config),
      } as unknown as TwitchUpdateRequest);
    },
    setPaused: async (config, paused) => {
      const body = { paused } satisfies TwitchUpdateRequest;
      await api.updateTwitchStream(config.id, body);
    },
    deleteConfig: async (config) => {
      await api.deleteTwitchStream(config.id.toString());
    },
    removeById: async (configId) => {
      await api.deleteTwitchStream(configId);
    },
    validateCreate: (configData) => (
      configData.twitchUsername && configData.discordChannelId
        ? null
        : t("hooks.twitchRequired")
    ),
    messages: {
      loadFailed: t("hooks.twitchLoadFailed"),
      createFailed: t("hooks.twitchSaveFailed"),
      updateFailed: t("hooks.twitchUpdateFailed"),
      deleteFailed: t("hooks.twitchDeleteFailed"),
    }
  });
}
