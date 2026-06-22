import type { ApiJsonResponse, ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type YouTubeListResponse = ApiJsonResponse<"/youtube", "get", 200>;
type YouTubeCreateRequest = ApiSchema<"YoutubeCreateRequest">;
type YouTubeCreateResponse = ApiJsonResponse<"/youtube", "post", 201>;
type YouTubeUpdateRequest = ApiSchema<"YoutubeUpdateRequest">;
type YouTubeUpdateResponse = ApiJsonResponse<"/youtube/{id}", "put", 200>;

export interface YouTubeMetadataResponse {
    channelId: string;
    title: string | null;
    url: string | null;
    latestVideoId: string | null;
}

export const youtubeApi = {
    resolveYouTubeIdentifier: (identifier: string) =>
        apiRequest<{ channelId: string | null }>(
            `${API_ENDPOINTS.YOUTUBE}/resolve?identifier=${encodeURIComponent(identifier)}`,
        ),

    getYouTubeChannelMetadata: (channelId: string) =>
        apiRequest<YouTubeMetadataResponse>(
            `${API_ENDPOINTS.YOUTUBE}/metadata?channelId=${encodeURIComponent(channelId)}`,
        ),

    getYouTubeConfigs: (guildId?: string) =>
        apiRequest<YouTubeListResponse>(guildId ? `${API_ENDPOINTS.YOUTUBE}?guildId=${encodeURIComponent(guildId)}` : API_ENDPOINTS.YOUTUBE),

    createYouTubeChannel: (data: YouTubeCreateRequest) =>
        apiRequest<YouTubeCreateResponse>(API_ENDPOINTS.YOUTUBE, { method: "POST", body: data }),

    updateYouTubeChannel: (id: string | number, data: YouTubeUpdateRequest) =>
        apiRequest<YouTubeUpdateResponse>(`${API_ENDPOINTS.YOUTUBE}/${id}`, { method: "PUT", body: data }),

    deleteYouTubeChannel: (id: string) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.YOUTUBE}/${id}`, { method: "DELETE" }),
};
