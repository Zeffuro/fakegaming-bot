import type { ApiJsonResponse } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiBinaryRequest, apiRequest } from "./core";

type GuildMemberSearchResponse = ApiJsonResponse<"/discord/guilds/{guildId}/members/search", "get", 200>;

export interface ResolveUsersResponse {
    users: Array<{
        id: string;
        username?: string;
        global_name?: string | null;
        discriminator?: string | null;
        avatar?: string | null;
        nickname?: string | null;
    }>;
    missed: string[];
}

export const discordApi = {
    resolveUsers: (guildId: string, ids: string[]) =>
        apiRequest<ResolveUsersResponse>(`${API_ENDPOINTS.DISCORD}/users/resolve`, { method: "POST", body: { guildId, ids } }),

    searchGuildMembers: (guildId: string, query: string, limit: number = 25) =>
        apiRequest<GuildMemberSearchResponse>(
            `${API_ENDPOINTS.DISCORD}/guilds/${encodeURIComponent(guildId)}/members/search?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`,
        ),

    getProfileCardImage: (guildId: string, userId: string) =>
        apiBinaryRequest(`${API_ENDPOINTS.DISCORD}/guilds/${encodeURIComponent(guildId)}/users/${encodeURIComponent(userId)}/profile-card`),
};
