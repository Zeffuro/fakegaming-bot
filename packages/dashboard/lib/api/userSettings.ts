import { API_ENDPOINTS, apiRequest } from "./core";
import type { DashboardLocale } from "@/lib/i18n/localeStore";

export interface UserSettings {
    discordId: string;
    timezone: string | null;
    defaultReminderTimeSpan: string | null;
    preferredLocale: DashboardLocale | null;
}

export interface UserSettingsUpdateInput {
    timezone?: string;
    defaultReminderTimeSpan?: string;
    preferredLocale?: DashboardLocale | null;
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
