import type { PatchSubscriptionConfig } from "@zeffuro/fakegaming-common";
import type { ApiJsonResponse, ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type SupportedGamesResponse = ApiJsonResponse<"/patchNotes/supportedGames", "get", 200>;
type PatchNoteResponse = ApiJsonResponse<"/patchNotes/{game}", "get", 200>;
type PatchSubscriptionCreateRequest = ApiSchema<"PatchSubscriptionRequest">;
type PatchSubscriptionUpsertRequest = ApiSchema<"PatchSubscriptionRequest">;

export const patchNotesApi = {
    getSupportedGames: () =>
        apiRequest<SupportedGamesResponse>(`${API_ENDPOINTS.PATCH_NOTES}/supportedGames`),

    getLatestPatchNote: (game: string) =>
        apiRequest<PatchNoteResponse>(`${API_ENDPOINTS.PATCH_NOTES}/${encodeURIComponent(game)}`),

    getPatchSubscriptions: (guildId?: string) =>
        apiRequest<PatchSubscriptionConfig[]>(
            guildId ? `${API_ENDPOINTS.PATCH_SUBSCRIPTIONS}?guildId=${encodeURIComponent(guildId)}` : API_ENDPOINTS.PATCH_SUBSCRIPTIONS,
        ),

    createPatchSubscription: (data: PatchSubscriptionCreateRequest) =>
        apiRequest<{ success: boolean }>(API_ENDPOINTS.PATCH_SUBSCRIPTIONS, { method: "POST", body: data }),

    upsertPatchSubscription: (data: PatchSubscriptionUpsertRequest) =>
        apiRequest<{ success: boolean }>(API_ENDPOINTS.PATCH_SUBSCRIPTIONS, { method: "PUT", body: data }),

    deletePatchSubscription: (id: string | number) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.PATCH_SUBSCRIPTIONS}/${id}`, { method: "DELETE" }),
};
