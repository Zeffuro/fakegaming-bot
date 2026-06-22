import { API_ENDPOINTS, apiRequest } from "./core";

export interface UserSettings {
    discordId: string;
    timezone: string | null;
    defaultReminderTimeSpan: string | null;
}

export interface UserSettingsUpdateInput {
    timezone?: string;
    defaultReminderTimeSpan?: string;
}

export const userSettingsApi = {
    getUserSettings: () =>
        apiRequest<UserSettings>(API_ENDPOINTS.USER_SETTINGS),

    updateUserSettings: (input: UserSettingsUpdateInput) =>
        apiRequest<UserSettings>(API_ENDPOINTS.USER_SETTINGS, {
            method: "PATCH",
            body: input,
        }),
};
