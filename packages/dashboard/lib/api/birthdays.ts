import type { BirthdayConfig } from "@zeffuro/fakegaming-common";
import { API_ENDPOINTS, apiRequest } from "./core";

export interface BirthdayPayload {
    userId: string;
    guildId?: string | null;
    channelId: string;
    day: number;
    month: number;
    year?: number;
}

export type BirthdayUpdatePayload = Omit<BirthdayPayload, "userId" | "guildId">;

export const birthdaysApi = {
    getBirthdays: (guildId: string) =>
        apiRequest<BirthdayConfig[]>(`${API_ENDPOINTS.BIRTHDAYS}?guildId=${encodeURIComponent(guildId)}`),

    createBirthday: (data: BirthdayPayload) =>
        apiRequest<{ success: boolean }>(API_ENDPOINTS.BIRTHDAYS, { method: "POST", body: data }),

    updateBirthday: (userId: string, guildId: string, data: BirthdayUpdatePayload) =>
        apiRequest<BirthdayConfig>(
            `${API_ENDPOINTS.BIRTHDAYS}/${encodeURIComponent(userId)}/${encodeURIComponent(guildId)}`,
            { method: "PUT", body: data },
        ),

    deleteBirthday: (userId: string, guildId: string) =>
        apiRequest<{ success: boolean }>(
            `${API_ENDPOINTS.BIRTHDAYS}/${encodeURIComponent(userId)}/${encodeURIComponent(guildId)}`,
            { method: "DELETE" },
        ),
};
