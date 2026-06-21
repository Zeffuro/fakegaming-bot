import { API_ENDPOINTS, apiRequest } from "./core";

export interface AdminNotificationRecord {
    id: number;
    provider: string;
    eventId: string;
    guildId?: string | null;
    channelId?: string | null;
    messageId?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface NotificationProviderSummary {
    provider: string;
    count: number;
}

export interface AdminNotificationsQuery {
    provider?: string;
    guildId?: string;
    limit?: number;
    offset?: number;
}

export interface AdminNotificationsResponse {
    records: AdminNotificationRecord[];
    total: number;
    limit: number;
    offset: number;
    summary: {
        total: number;
        byProvider: NotificationProviderSummary[];
    };
}

export const notificationsApi = {
    getAdminNotifications: (query: AdminNotificationsQuery = {}) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null && value !== "") {
                params.set(key, String(value));
            }
        }

        const suffix = params.toString() ? `?${params.toString()}` : "";
        return apiRequest<AdminNotificationsResponse>(`${API_ENDPOINTS.NOTIFICATIONS}/admin${suffix}`);
    },
};
