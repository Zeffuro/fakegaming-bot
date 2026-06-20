import type { ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type QuoteResponse = ApiSchema<"QuoteConfig">;
type QuoteCreateRequest = ApiSchema<"QuoteCreateRequest">;

export const quotesApi = {
    getQuotesByGuild: (guildId: string) =>
        apiRequest<QuoteResponse[]>(`${API_ENDPOINTS.QUOTES}/guild/${encodeURIComponent(guildId)}`),

    searchQuotes: (guildId: string, text: string) =>
        apiRequest<QuoteResponse[]>(`${API_ENDPOINTS.QUOTES}/search?guildId=${encodeURIComponent(guildId)}&text=${encodeURIComponent(text)}`),

    createQuote: (data: QuoteCreateRequest) =>
        apiRequest<QuoteResponse>(API_ENDPOINTS.QUOTES, { method: "POST", body: data }),

    deleteQuote: (id: string) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.QUOTES}/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
