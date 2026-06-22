import type { ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

export interface SteamNewsSubscriptionConfig {
    id?: number;
    steamAppId: number;
    appName?: string | null;
    discordChannelId: string;
    guildId: string;
    lastNewsGid?: string | null;
    lastAnnouncedAt?: number | string | null;
    customMessage?: string | null;
    cooldownMinutes?: number | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    paused?: boolean | null;
}

export type SteamNewsSubscriptionRequest = ApiSchema<"SteamNewsSubscriptionRequest">;

export interface SteamAppSearchResult {
    steamAppId: number;
    appName: string;
    score: number;
}

export const steamNewsApi = {
    searchSteamApps: (query: string, limit = 10) =>
        apiRequest<{ results: SteamAppSearchResult[] }>(
            `${API_ENDPOINTS.STEAM_APPS}/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`,
        ),

    resolveSteamApp: (query: string, limit = 10) =>
        apiRequest<SteamAppSearchResult>(
            `${API_ENDPOINTS.STEAM_APPS}/resolve?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`,
        ),

    getSteamNewsSubscriptions: (guildId?: string) =>
        apiRequest<SteamNewsSubscriptionConfig[]>(
            guildId ? `${API_ENDPOINTS.STEAM_NEWS_SUBSCRIPTIONS}?guildId=${encodeURIComponent(guildId)}` : API_ENDPOINTS.STEAM_NEWS_SUBSCRIPTIONS,
        ),

    createSteamNewsSubscription: (data: SteamNewsSubscriptionRequest) =>
        apiRequest<SteamNewsSubscriptionConfig>(API_ENDPOINTS.STEAM_NEWS_SUBSCRIPTIONS, { method: "POST", body: data }),

    upsertSteamNewsSubscription: (data: SteamNewsSubscriptionRequest) =>
        apiRequest<{ success: boolean }>(API_ENDPOINTS.STEAM_NEWS_SUBSCRIPTIONS, { method: "PUT", body: data }),

    setSteamNewsSubscriptionPaused: (id: string | number, paused: boolean) =>
        apiRequest<SteamNewsSubscriptionConfig>(`${API_ENDPOINTS.STEAM_NEWS_SUBSCRIPTIONS}/${id}`, { method: "PATCH", body: { paused } }),

    deleteSteamNewsSubscription: (id: string | number) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.STEAM_NEWS_SUBSCRIPTIONS}/${id}`, { method: "DELETE" }),
};
