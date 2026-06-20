import type { ApiJsonResponse, ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type TwitchListResponse = ApiJsonResponse<"/twitch", "get", 200>;
type TwitchCreateRequest = ApiSchema<"TwitchCreateRequest">;
type TwitchCreateResponse = ApiJsonResponse<"/twitch", "post", 200 | 201>;

export const twitchApi = {
    getTwitchConfigs: (guildId?: string) =>
        apiRequest<TwitchListResponse>(guildId ? `${API_ENDPOINTS.TWITCH}?guildId=${encodeURIComponent(guildId)}` : API_ENDPOINTS.TWITCH),

    createTwitchStream: (data: TwitchCreateRequest) =>
        apiRequest<TwitchCreateResponse>(API_ENDPOINTS.TWITCH, { method: "POST", body: data }),

    deleteTwitchStream: (id: string) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.TWITCH}/${id}`, { method: "DELETE" }),

    verifyTwitchUsername: (username: string) =>
        apiRequest<{ exists: boolean; id?: string; login?: string; displayName?: string }>(
            `${API_ENDPOINTS.TWITCH}/verify?username=${encodeURIComponent(username)}`,
        ),
};
