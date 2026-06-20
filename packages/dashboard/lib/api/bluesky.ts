import type { ApiJsonResponse, ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type BlueskyListResponse = ApiJsonResponse<"/bluesky", "get", 200>;
export type BlueskyCreateRequest = ApiSchema<"BlueskyCreateRequest">;
type BlueskyCreateResponse = ApiJsonResponse<"/bluesky", "post", 200 | 201>;
type BlueskyDeleteResponse = ApiJsonResponse<"/bluesky/{id}", "delete", 200>;
export type BlueskyProfileResponse = ApiJsonResponse<"/bluesky/profile", "get", 200>;

export const blueskyApi = {
    getBlueskyConfigs: (guildId?: string) =>
        apiRequest<BlueskyListResponse>(guildId ? `${API_ENDPOINTS.BLUESKY}?guildId=${encodeURIComponent(guildId)}` : API_ENDPOINTS.BLUESKY),

    getBlueskyProfile: (handle: string) =>
        apiRequest<BlueskyProfileResponse>(`${API_ENDPOINTS.BLUESKY}/profile?handle=${encodeURIComponent(handle)}`),

    createBlueskyAccount: (data: BlueskyCreateRequest) =>
        apiRequest<BlueskyCreateResponse>(API_ENDPOINTS.BLUESKY, { method: "POST", body: data }),

    deleteBlueskyAccount: (id: string | number) =>
        apiRequest<BlueskyDeleteResponse>(`${API_ENDPOINTS.BLUESKY}/${id}`, { method: "DELETE" }),
};
