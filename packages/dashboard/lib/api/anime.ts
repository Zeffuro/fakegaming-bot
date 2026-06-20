import { API_ENDPOINTS, apiRequest } from "./core";

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

export interface AnimePageInfo {
    total?: number | null;
    currentPage?: number | null;
    lastPage?: number | null;
    hasNextPage?: boolean | null;
    perPage?: number | null;
}

export type AnimeSearchMediaType = "anime" | "manga";

export interface AnimeSearchResult {
    id: number;
    type?: "ANIME" | "MANGA" | null;
    title: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
    };
    description?: string | null;
    synonyms?: string[] | null;
    siteUrl?: string | null;
    coverImage?: { large?: string | null; color?: string | null } | null;
    bannerImage?: string | null;
    format?: string | null;
    status?: string | null;
    season?: string | null;
    seasonYear?: number | null;
    episodes?: number | null;
    duration?: number | null;
    chapters?: number | null;
    volumes?: number | null;
    countryOfOrigin?: string | null;
    averageScore?: number | null;
    meanScore?: number | null;
    popularity?: number | null;
    rankings?: Array<{
        rank: number;
        type?: string | null;
        allTime?: boolean | null;
        context?: string | null;
        year?: number | null;
        season?: string | null;
        format?: string | null;
    }> | null;
    genres?: string[] | null;
    nextAiringEpisode?: { airingAt: number; episode: number; timeUntilAiring?: number | null } | null;
}

export const animeApi = {
    getAnimeSubscriptions: (guildId: string) =>
        apiRequest<AnimeSubscriptionDashboardConfig[]>(`${API_ENDPOINTS.ANIME}?guildId=${encodeURIComponent(guildId)}`),

    getMyAnimeSubscriptions: () =>
        apiRequest<AnimeSubscriptionDashboardConfig[]>(API_ENDPOINTS.ANIME),

    searchAnime: (query: string, page: number = 1, perPage: number = 10, type: AnimeSearchMediaType = "anime") =>
        apiRequest<{ type: "ANIME" | "MANGA"; results: AnimeSearchResult[]; pageInfo: AnimePageInfo }>(
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
