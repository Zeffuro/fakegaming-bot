import { API_ENDPOINTS, apiRequest } from "./core";

export interface UserReminder {
    id: string;
    userId: string;
    message: string;
    timespan: string;
    timestamp: number;
    completed: boolean;
    recurrenceUnit: "day" | "week" | "month" | null;
    recurrenceInterval: number | null;
    recurrenceTimezone: string | null;
    lastTriggeredAt: number | null;
    nextPreviewAt: number | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface UserReminderListResponse {
    reminders: UserReminder[];
}

export interface UserReminderInput {
    message: string;
    timespan: string;
    recurrence?: string;
    recurrenceTimezone?: string;
}

export interface UserReminderSnoozeInput {
    timespan: string;
}

export interface UserReminderPausedInput {
    paused: boolean;
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

    setUserReminderPaused: (id: string, input: UserReminderPausedInput) =>
        apiRequest<UserReminder>(`${API_ENDPOINTS.USER_REMINDERS}/${encodeURIComponent(id)}/paused`, {
            method: "PATCH",
            body: input,
        }),

    deleteUserReminder: (id: string) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.USER_REMINDERS}/${encodeURIComponent(id)}`, {
            method: "DELETE",
        }),
};
