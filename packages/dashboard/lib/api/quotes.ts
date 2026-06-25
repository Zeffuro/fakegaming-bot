import type { ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiBinaryRequest, apiRequest } from "./core";

type QuoteResponse = ApiSchema<"QuoteConfig">;
type QuoteCreateRequest = ApiSchema<"QuoteCreateRequest">;
export type QuoteModerationStatus = "pending" | "approved" | "rejected";

export interface QuoteOfDaySettingsResponse {
    guildId: string;
    channelId: string;
    enabled: boolean;
    runHourUtc: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface QuoteOfDayPreviewResponse {
    date: string;
    quote: QuoteResponse | null;
    eligibleCount: number;
    settings: QuoteOfDaySettingsResponse | null;
}

export interface QuoteOfDaySettingsRequest {
    channelId: string;
    enabled: boolean;
    runHourUtc?: number;
}

export const quotesApi = {
    getQuotesByGuild: (guildId: string) =>
        apiRequest<QuoteResponse[]>(`${API_ENDPOINTS.QUOTES}/guild/${encodeURIComponent(guildId)}`),

    searchQuotes: (guildId: string, text: string) =>
        apiRequest<QuoteResponse[]>(`${API_ENDPOINTS.QUOTES}/search?guildId=${encodeURIComponent(guildId)}&text=${encodeURIComponent(text)}`),

    createQuote: (data: QuoteCreateRequest) =>
        apiRequest<QuoteResponse>(API_ENDPOINTS.QUOTES, { method: "POST", body: data }),

    setQuoteModerationStatus: (id: string, moderationStatus: QuoteModerationStatus) =>
        apiRequest<QuoteResponse>(`${API_ENDPOINTS.QUOTES}/${encodeURIComponent(id)}/moderation`, {
            method: "PATCH",
            body: { moderationStatus },
        }),

    getQuoteOfDayPreview: (guildId: string, date?: string) => {
        const params = new URLSearchParams();
        if (date) params.set("date", date);
        const suffix = params.toString() ? `?${params.toString()}` : "";
        return apiRequest<QuoteOfDayPreviewResponse>(`${API_ENDPOINTS.QUOTES}/guild/${encodeURIComponent(guildId)}/quote-of-day${suffix}`);
    },

    updateQuoteOfDaySettings: (guildId: string, body: QuoteOfDaySettingsRequest) =>
        apiRequest<QuoteOfDaySettingsResponse>(`${API_ENDPOINTS.QUOTES}/guild/${encodeURIComponent(guildId)}/quote-of-day/settings`, {
            method: "PUT",
            body,
        }),

    getQuoteCardImage: (id: string) =>
        apiBinaryRequest(`${API_ENDPOINTS.QUOTES}/${encodeURIComponent(id)}/card`),

    deleteQuote: (id: string) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.QUOTES}/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
