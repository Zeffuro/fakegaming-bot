import { API_ENDPOINTS, apiRequest } from "./core";
import type {
    AniListMediaType,
    AniListPageInfo,
    AniListTitle,
} from "@zeffuro/fakegaming-common/anime";

export interface AnimeSubscriptionDashboardConfig {
    id?: number;
    anilistId: number;
    animeTitle: string;
    discordChannelId: string;
    channelId?: string;
    guildId: string;
    targetType?: "dm" | "channel";
    userId?: string | null;
    reminderMinutes: number;
    status?: string | null;
    format?: string | null;
    episodes?: number | null;
    averageScore?: number | null;
    nextEpisode?: number | null;
    nextAiringAt?: number | null;
    customMessage?: string;
}

export type AnimePageInfo = AniListPageInfo;

export type AnimeSearchMediaType = "anime" | "manga";

export type AnimeSearchResult = AniListTitle;

export const animeApi = {
    getAnimeSubscriptions: (guildId: string) =>
        apiRequest<AnimeSubscriptionDashboardConfig[]>(`${API_ENDPOINTS.ANIME}?guildId=${encodeURIComponent(guildId)}`),

    getMyAnimeSubscriptions: () =>
        apiRequest<AnimeSubscriptionDashboardConfig[]>(API_ENDPOINTS.ANIME),

    searchAnime: (query: string, page: number = 1, perPage: number = 10, type: AnimeSearchMediaType = "anime") =>
        apiRequest<{ type: AniListMediaType; results: AnimeSearchResult[]; pageInfo: AnimePageInfo }>(
            `${API_ENDPOINTS.ANIME}/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&page=${encodeURIComponent(String(page))}&perPage=${encodeURIComponent(String(perPage))}`,
        ),

    getAnimeSeason: (season: string, year?: number, page: number = 1, perPage: number = 10, scope: string = "airing") =>
        apiRequest<{ season: string; year: number; scope: string; scopeLabel: string; results: AnimeSearchResult[]; pageInfo: AnimePageInfo }>(
            `${API_ENDPOINTS.ANIME}/season?season=${encodeURIComponent(season)}&scope=${encodeURIComponent(scope)}${year ? `&year=${encodeURIComponent(String(year))}` : ""}&page=${encodeURIComponent(String(page))}&perPage=${encodeURIComponent(String(perPage))}`,
        ),

    createAnimeSubscription: (data: { anilistId?: number; title?: string; guildId: string; channelId: string; reminderMinutes?: number }) =>
        apiRequest<{ success: boolean; created: boolean; anilistId: number }>(
            API_ENDPOINTS.ANIME,
            { method: "POST", body: data },
        ),

    deleteAnimeSubscription: (id: string | number) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.ANIME}/${id}`, { method: "DELETE" }),
};
