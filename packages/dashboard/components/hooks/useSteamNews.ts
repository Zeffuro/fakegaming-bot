import { api, type SteamNewsSubscriptionConfig, type SteamNewsSubscriptionRequest } from "@/lib/api-client";
import { buildNotificationTimingPayload, useConfigResource } from "@/components/hooks/useConfigResource";
import type { ConfigDialogItemOption } from "@/components/config-dialog/ConfigDialogFields";

interface UseSteamNewsConfigsOptions {
    enabled?: boolean;
}

export interface SteamNewsDashboardConfig {
    id?: number;
    steamAppId: string;
    appName?: string;
    discordChannelId: string;
    guildId: string;
    lastNewsGid?: string | null;
    lastAnnouncedAt?: number | string | null;
    customMessage?: string;
    cooldownMinutes?: number | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    paused?: boolean | null;
    youtubeChannelTitle?: string;
}

type SteamNewsCreateConfig = Omit<SteamNewsDashboardConfig, "id" | "guildId">;

export function useSteamNewsConfigs(guildId: string | string[], options: UseSteamNewsConfigsOptions = {}) {
    return useConfigResource<SteamNewsDashboardConfig, SteamNewsCreateConfig>({
        guildId,
        enabled: options.enabled ?? true,
        load: async (resolvedGuildId) => {
            const allConfigs = await api.getSteamNewsSubscriptions(resolvedGuildId);
            return allConfigs
                .filter((config) => config.guildId === resolvedGuildId)
                .map(toDashboardConfig);
        },
        create: async (configData, resolvedGuildId) => {
            await api.createSteamNewsSubscription(await buildSteamNewsRequest(configData, resolvedGuildId));
        },
        update: async (config, resolvedGuildId) => {
            if (config.id !== undefined) {
                await api.deleteSteamNewsSubscription(config.id);
            }
            await api.createSteamNewsSubscription(await buildSteamNewsRequest(config, resolvedGuildId));
        },
        setPaused: async (config, paused) => {
            if (config.id === undefined) {
                throw new Error("Steam news subscription ID is required");
            }
            await api.setSteamNewsSubscriptionPaused(config.id, paused);
        },
        deleteConfig: async (config) => {
            if (config.id === undefined) {
                throw new Error("Steam news subscription ID is required");
            }
            await api.deleteSteamNewsSubscription(config.id);
        },
        removeById: async (configId) => {
            await api.deleteSteamNewsSubscription(configId);
        },
        validateCreate: validateSteamNewsConfig,
        messages: {
            loadFailed: "Failed to load Steam news subscriptions",
            createFailed: "Failed to save Steam news subscription",
            updateFailed: "Failed to update Steam news subscription",
            deleteFailed: "Failed to delete Steam news subscription",
        },
    });
}

export async function searchSteamNewsAppOptions(query: string): Promise<ConfigDialogItemOption[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const response = await api.searchSteamApps(trimmed, 10);
    return response.results.map((result) => ({
        label: `${result.appName} (${result.steamAppId})`,
        value: String(result.steamAppId),
        description: `Steam App ID ${result.steamAppId}`,
        fieldValues: {
            appName: result.appName,
        },
    }));
}

function toDashboardConfig(config: SteamNewsSubscriptionConfig): SteamNewsDashboardConfig {
    const appName = normalizeOptionalString(config.appName);
    return {
        id: config.id,
        steamAppId: String(config.steamAppId),
        appName,
        discordChannelId: config.discordChannelId,
        guildId: config.guildId,
        lastNewsGid: config.lastNewsGid ?? null,
        lastAnnouncedAt: config.lastAnnouncedAt ?? null,
        customMessage: normalizeOptionalString(config.customMessage),
        cooldownMinutes: config.cooldownMinutes ?? null,
        quietHoursStart: config.quietHoursStart ?? null,
        quietHoursEnd: config.quietHoursEnd ?? null,
        paused: config.paused ?? false,
        youtubeChannelTitle: appName ?? `Steam app ${config.steamAppId}`,
    };
}

async function buildSteamNewsRequest(config: SteamNewsCreateConfig | SteamNewsDashboardConfig, guildId: string): Promise<SteamNewsSubscriptionRequest> {
    const resolved = await resolveSteamAppForRequest(config);
    return {
        steamAppId: resolved.steamAppId,
        appName: resolved.appName,
        discordChannelId: config.discordChannelId,
        guildId,
        ...buildNotificationTimingPayload(config),
    } as SteamNewsSubscriptionRequest;
}

function validateSteamNewsConfig(config: SteamNewsCreateConfig): string | null {
    if (!normalizeOptionalString(config.steamAppId)) {
        return "Game, Steam App ID, or Steam URL is required";
    }
    if (!config.discordChannelId) {
        return "Discord Channel is required";
    }
    return null;
}

async function resolveSteamAppForRequest(config: SteamNewsCreateConfig | SteamNewsDashboardConfig): Promise<{ steamAppId: number; appName?: string }> {
    const input = String(config.steamAppId).trim();
    const directAppId = Number(input);
    if (Number.isInteger(directAppId) && directAppId > 0) {
        return {
            steamAppId: directAppId,
            appName: normalizeOptionalString(config.appName),
        };
    }

    const resolved = await api.resolveSteamApp(input, 5);
    return {
        steamAppId: resolved.steamAppId,
        appName: resolved.appName,
    };
}

function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
}
