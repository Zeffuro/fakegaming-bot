import { API_ENDPOINTS, apiRequest } from "./core";

export type UserDigestFrequency = "daily" | "weekly";
export type UserDigestCategory = "reminders" | "anime";

export interface UserDigestSubscription {
    id: string;
    discordId: string;
    frequency: UserDigestFrequency;
    timezone: string;
    runAt: string;
    dayOfWeek: number | null;
    categories: UserDigestCategory[];
    paused: boolean;
    nextRunAt: number;
    lastRunAt: number | null;
    lastSentAt: number | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface UserDigestSubscriptionResponse {
    subscription: UserDigestSubscription | null;
}

export interface UserDigestSubscriptionInput {
    frequency: UserDigestFrequency;
    timezone: string;
    runAt: string;
    dayOfWeek?: number | null;
    categories?: UserDigestCategory[];
    paused?: boolean;
}

export interface UserDigestPausedInput {
    paused: boolean;
}

export const userDigestSubscriptionApi = {
    getUserDigestSubscription: () =>
        apiRequest<UserDigestSubscriptionResponse>(API_ENDPOINTS.USER_DIGEST_SUBSCRIPTION),

    saveUserDigestSubscription: (input: UserDigestSubscriptionInput) =>
        apiRequest<UserDigestSubscriptionResponse>(API_ENDPOINTS.USER_DIGEST_SUBSCRIPTION, {
            method: "PUT",
            body: input,
        }),

    setUserDigestSubscriptionPaused: (input: UserDigestPausedInput) =>
        apiRequest<UserDigestSubscriptionResponse>(`${API_ENDPOINTS.USER_DIGEST_SUBSCRIPTION}/paused`, {
            method: "PATCH",
            body: input,
        }),
};
