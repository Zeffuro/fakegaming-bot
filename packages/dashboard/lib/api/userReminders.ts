import { API_ENDPOINTS, apiRequest } from "./core";

export interface UserReminder {
    id: string;
    userId: string;
    message: string;
    timespan: string;
    timestamp: number;
    completed: boolean;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface UserReminderListResponse {
    reminders: UserReminder[];
}

export interface UserReminderInput {
    message: string;
    timespan: string;
}

export interface UserReminderSnoozeInput {
    timespan: string;
}

export const userRemindersApi = {
    listUserReminders: () =>
        apiRequest<UserReminderListResponse>(API_ENDPOINTS.USER_REMINDERS),

    createUserReminder: (input: UserReminderInput) =>
        apiRequest<UserReminder>(API_ENDPOINTS.USER_REMINDERS, {
            method: "POST",
            body: input,
        }),

    snoozeUserReminder: (id: string, input: UserReminderSnoozeInput) =>
        apiRequest<UserReminder>(`${API_ENDPOINTS.USER_REMINDERS}/${encodeURIComponent(id)}/snooze`, {
            method: "PATCH",
            body: input,
        }),

    deleteUserReminder: (id: string) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.USER_REMINDERS}/${encodeURIComponent(id)}`, {
            method: "DELETE",
        }),
};
