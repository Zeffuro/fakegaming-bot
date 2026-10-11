import { apiRequest } from './core';
import type { NotificationHistoryKind, NotificationHistoryStatus, NotificationHistoryPage } from '@zeffuro/fakegaming-common/api';
export type { NotificationHistoryKind, NotificationHistoryStatus, NotificationHistoryEntry, NotificationHistoryPage } from '@zeffuro/fakegaming-common/api';

export interface NotificationHistoryQuery {
    kind?: NotificationHistoryKind; status?: NotificationHistoryStatus; offset?: number; limit?: number;
}
export const notificationHistoryApi = {
    list: (query: NotificationHistoryQuery = {}) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) if (value !== undefined) search.set(key, String(value));
        return apiRequest<NotificationHistoryPage>(`/api/external/userNotificationHistory?${search}`);
    },
};
