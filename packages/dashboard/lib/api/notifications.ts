import { API_ENDPOINTS, apiRequest } from "./core";

export interface NotificationDeliveryRecord {
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

export interface NotificationsQuery {
    provider?: string;
    guildId?: string;
    limit?: number;
    offset?: number;
}

export interface NotificationsResponse {
    records: NotificationDeliveryRecord[];
    total: number;
    limit: number;
    offset: number;
    summary: {
        total: number;
        byProvider: NotificationProviderSummary[];
    };
}

export type AdminNotificationRecord = NotificationDeliveryRecord;
export type AdminNotificationsQuery = NotificationsQuery;
export type AdminNotificationsResponse = NotificationsResponse;
export type GuildNotificationsQuery = Omit<NotificationsQuery, "guildId">;
export type GuildNotificationsResponse = NotificationsResponse;

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

    getGuildNotifications: (guildId: string, query: GuildNotificationsQuery = {}) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null && value !== "") {
                params.set(key, String(value));
            }
        }

        const suffix = params.toString() ? `?${params.toString()}` : "";
        return apiRequest<GuildNotificationsResponse>(`${API_ENDPOINTS.NOTIFICATIONS}/guild/${encodeURIComponent(guildId)}${suffix}`);
    },
};
