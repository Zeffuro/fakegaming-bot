import type { ApiJsonResponse, ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type TikTokListResponse = ApiJsonResponse<"/tiktok", "get", 200>;
type TikTokCreateRequest = ApiSchema<"TikTokCreateRequest">;
type TikTokCreateResponse = ApiJsonResponse<"/tiktok", "post", 200 | 201>;
type TikTokDeleteResponse = ApiJsonResponse<"/tiktok/{id}", "delete", 200>;

export interface TikTokLiveResponse {
    live: boolean;
    roomId: string | null;
    title: string | null;
    startedAt: number | null;
    viewers: number | null;
    cover: string | null;
    debugMeta?: {
        method: "fetchIsLive" | "getRoomInfo" | "connect" | "unknown";
        raw?: unknown;
    };
}

export const tiktokApi = {
    getTikTokConfigs: (guildId?: string) =>
        apiRequest<TikTokListResponse>(guildId ? `${API_ENDPOINTS.TIKTOK}?guildId=${encodeURIComponent(guildId)}` : API_ENDPOINTS.TIKTOK),

    getTikTokLive: (username: string, debug: boolean = false) =>
        apiRequest<TikTokLiveResponse>(
            `${API_ENDPOINTS.TIKTOK}/live?username=${encodeURIComponent(username)}${debug ? "&debug=1" : ""}`,
        ),

    createTikTokStream: (data: TikTokCreateRequest) =>
        apiRequest<TikTokCreateResponse>(API_ENDPOINTS.TIKTOK, { method: "POST", body: data }),

    deleteTikTokStream: (id: string | number) =>
        apiRequest<TikTokDeleteResponse>(`${API_ENDPOINTS.TIKTOK}/${id}`, { method: "DELETE" }),
};
