import { API_ENDPOINTS, apiRequest } from "./core";

export type IntegrationHealthStatus = "unknown" | "healthy" | "warning" | "error" | "paused";

export interface IntegrationHealthRecord {
    id: number;
    provider: string;
    configId: string;
    guildId?: string | null;
    channelId?: string | null;
    status: IntegrationHealthStatus;
    lastCheckedAt?: string | null;
    lastSuccessAt?: string | null;
    lastFailureAt?: string | null;
    lastDeliveryAt?: string | null;
    consecutiveFailures: number;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface IntegrationHealthResponse {
    records: IntegrationHealthRecord[];
}

export interface IntegrationHealthSummary {
    total: number;
    healthy: number;
    warning: number;
    error: number;
    paused: number;
    unknown: number;
}

export interface AdminIntegrationHealthQuery {
    provider?: string;
    guildId?: string;
    status?: IntegrationHealthStatus;
    limit?: number;
    offset?: number;
}

export interface AdminIntegrationHealthResponse {
    records: IntegrationHealthRecord[];
    total: number;
    limit: number;
    offset: number;
    summary: IntegrationHealthSummary;
}

export interface AdminIntegrationHealthResolveResponse {
    record: IntegrationHealthRecord | null;
}

export const integrationHealthApi = {
    getIntegrationHealth: (guildId: string, provider?: string) => {
        const query = new URLSearchParams({ guildId });
        if (provider) query.set("provider", provider);
        return apiRequest<IntegrationHealthResponse>(`${API_ENDPOINTS.INTEGRATION_HEALTH}?${query.toString()}`);
    },

    getAdminIntegrationHealth: (query: AdminIntegrationHealthQuery = {}) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null && value !== "") {
                params.set(key, String(value));
            }
        }
        const suffix = params.toString() ? `?${params.toString()}` : "";
        return apiRequest<AdminIntegrationHealthResponse>(`${API_ENDPOINTS.INTEGRATION_HEALTH}/admin${suffix}`);
    },

    resolveAdminIntegrationHealth: (provider: string, configId: string) =>
        apiRequest<AdminIntegrationHealthResolveResponse>(
            `${API_ENDPOINTS.INTEGRATION_HEALTH}/admin/${encodeURIComponent(provider)}/${encodeURIComponent(configId)}/resolve`,
            { method: "POST" },
        ),
};
