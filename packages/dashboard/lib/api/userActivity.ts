import { API_ENDPOINTS, apiRequest } from "./core";
import type { AuditEventEntry } from "./audit";
import type { NotificationDeliveryRecord } from "./notifications";

export type UserActivityAuditEvent = AuditEventEntry;
export type UserActivityDeliveryRecord = NotificationDeliveryRecord;

export interface UserActivitySummary {
    auditTotal: number;
    deliveryTotal: number;
}

export interface UserActivityResponse {
    auditEvents: UserActivityAuditEvent[];
    deliveries: UserActivityDeliveryRecord[];
    summary: UserActivitySummary;
}

export interface UserActivityQuery {
    auditLimit?: number;
    deliveryLimit?: number;
}

export const userActivityApi = {
    getUserActivity: (query: UserActivityQuery = {}) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null && value !== "") {
                params.set(key, String(value));
            }
        }

        const suffix = params.toString() ? `?${params.toString()}` : "";
        return apiRequest<UserActivityResponse>(`${API_ENDPOINTS.USER_ACTIVITY}${suffix}`);
    },
};
