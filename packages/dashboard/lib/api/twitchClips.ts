import { apiRequest } from "./core";

export type TwitchClipPermission = "everyone" | "subscribers" | "moderators" | "owner";

export interface TwitchClipInput {
    guildId: string;
    twitchUsername: string;
    discordChannelId: string;
    command: string;
    aliases: string[];
    permission: TwitchClipPermission;
    cooldownSeconds: number;
    durationSeconds: number;
    enabled: boolean;
}

export interface TwitchClipConfig extends TwitchClipInput {
    id: string;
    broadcasterId: string;
}

export interface TwitchClipBotStatus {
    configured: boolean;
    connected: boolean;
    login: string | null;
    expectedLogin: string | null;
    jobsEnabled: boolean;
    chatConnected: boolean;
    subscribedChannels: number;
    lastErrorCode: string | null;
}

const endpoint = "/api/external/twitchClips";

export const twitchClipsApi = {
    list: (guildId: string) => apiRequest<TwitchClipConfig[]>(`${endpoint}?guildId=${encodeURIComponent(guildId)}`),
    create: (input: TwitchClipInput) => apiRequest<TwitchClipConfig>(endpoint, { method: "POST", body: input }),
    update: (id: string, input: Partial<TwitchClipInput>) => apiRequest<TwitchClipConfig>(`${endpoint}/${encodeURIComponent(id)}`, { method: "PUT", body: input }),
    remove: (id: string) => apiRequest<{ success: boolean }>(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    status: () => apiRequest<TwitchClipBotStatus>(`${endpoint}/bot/status`),
    connect: (guildId?: string) => apiRequest<{ url: string }>("/api/auth/twitch/connect", { method: "POST", body: guildId ? { guildId } : {} }),
    disconnect: () => apiRequest<{ success: boolean }>(`${endpoint}/bot`, { method: "DELETE" }),
};
