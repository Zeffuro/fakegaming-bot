import type { PatchSubscriptionConfig } from "@zeffuro/fakegaming-common";
import type { ApiJsonResponse, ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type SupportedGamesResponse = ApiJsonResponse<"/patchNotes/supportedGames", "get", 200>;
type PatchNoteResponse = ApiJsonResponse<"/patchNotes/{game}", "get", 200>;
type PatchSubscriptionCreateRequest = ApiSchema<"PatchSubscriptionRequest">;
type PatchSubscriptionUpsertRequest = ApiSchema<"PatchSubscriptionRequest">;

export interface PatchNoteHistoryItem {
    accentColor?: number | null;
    contentBytes: number;
    contentPreview: string;
    game: string;
    id: number;
    imageUrl?: string | null;
    logoUrl?: string | null;
    publishedAt: number;
    title: string;
    url: string;
    version?: string | null;
}

export interface PatchNoteHistoryResponse {
    items: PatchNoteHistoryItem[];
    limit: number;
    offset: number;
    total: number;
}

export interface PatchNoteHistoryQuery {
    from?: number;
    game?: string;
    limit?: number;
    offset?: number;
    q?: string;
    to?: number;
}

export type PatchNoteHistoryDiffLineKind = "added" | "removed" | "unchanged";

export interface PatchNoteHistoryDiffLine {
    kind: PatchNoteHistoryDiffLineKind;
    leftLine?: number;
    rightLine?: number;
    text: string;
}

export interface PatchNoteHistoryCompareRecord {
    contentBytes: number;
    game: string;
    id: number;
    publishedAt: number;
    title: string;
    url: string;
    version: string | null;
}

export interface PatchNoteHistoryCompareResponse {
    diff: PatchNoteHistoryDiffLine[];
    left: PatchNoteHistoryCompareRecord;
    right: PatchNoteHistoryCompareRecord;
    summary: {
        addedLines: number;
        emittedLines: number;
        inputTruncated: boolean;
        maxDiffLines: number;
        maxInputLines: number;
        removedLines: number;
        totalDiffLines: number;
        truncated: boolean;
        unchangedLines: number;
    };
}

export interface PatchNoteHistoryCompareQuery {
    leftId: number;
    rightId: number;
}

export const patchNotesApi = {
    getSupportedGames: () =>
        apiRequest<SupportedGamesResponse>(`${API_ENDPOINTS.PATCH_NOTES}/supportedGames`),

    getLatestPatchNote: (game: string) =>
        apiRequest<PatchNoteResponse>(`${API_ENDPOINTS.PATCH_NOTES}/${encodeURIComponent(game)}`),

    getPatchNoteHistory: (query: PatchNoteHistoryQuery = {}) => {
        const params = new URLSearchParams();
        if (query.game) params.set("game", query.game);
        if (query.q) params.set("q", query.q);
        if (typeof query.from === "number") params.set("from", String(query.from));
        if (typeof query.to === "number") params.set("to", String(query.to));
        if (typeof query.limit === "number") params.set("limit", String(query.limit));
        if (typeof query.offset === "number") params.set("offset", String(query.offset));
        const search = params.toString();
        return apiRequest<PatchNoteHistoryResponse>(`${API_ENDPOINTS.PATCH_NOTES}/history${search ? `?${search}` : ""}`);
    },

    comparePatchNoteHistory: (query: PatchNoteHistoryCompareQuery) => {
        const params = new URLSearchParams({
            leftId: String(query.leftId),
            rightId: String(query.rightId),
        });
        return apiRequest<PatchNoteHistoryCompareResponse>(`${API_ENDPOINTS.PATCH_NOTES}/history/compare?${params.toString()}`);
    },

    getPatchSubscriptions: (guildId?: string) =>
        apiRequest<PatchSubscriptionConfig[]>(
            guildId ? `${API_ENDPOINTS.PATCH_SUBSCRIPTIONS}?guildId=${encodeURIComponent(guildId)}` : API_ENDPOINTS.PATCH_SUBSCRIPTIONS,
        ),

    createPatchSubscription: (data: PatchSubscriptionCreateRequest) =>
        apiRequest<{ success: boolean }>(API_ENDPOINTS.PATCH_SUBSCRIPTIONS, { method: "POST", body: data }),

    upsertPatchSubscription: (data: PatchSubscriptionUpsertRequest) =>
        apiRequest<{ success: boolean }>(API_ENDPOINTS.PATCH_SUBSCRIPTIONS, { method: "PUT", body: data }),

    setPatchSubscriptionPaused: (id: string | number, paused: boolean) =>
        apiRequest<PatchSubscriptionConfig>(`${API_ENDPOINTS.PATCH_SUBSCRIPTIONS}/${id}`, { method: "PATCH", body: { paused } }),

    deletePatchSubscription: (id: string | number) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.PATCH_SUBSCRIPTIONS}/${id}`, { method: "DELETE" }),
};
