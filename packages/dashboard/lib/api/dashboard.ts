import { API_ENDPOINTS, apiRequest } from "./core";

export interface GuildDashboardSummaryCounts {
    twitch: number;
    tiktok: number;
    bluesky: number;
    youtube: number;
    patchSubscriptions: number;
    anime: number;
    birthdays: number;
}

export interface GuildDashboardSummary {
    guildId: string;
    counts: GuildDashboardSummaryCounts;
    totalConfigured: number;
}

export const dashboardApi = {
    getGuildDashboardSummary: (guildId: string) =>
        apiRequest<GuildDashboardSummary>(
            `${API_ENDPOINTS.DASHBOARD}/guild/${encodeURIComponent(guildId)}/summary`,
        ),
};
