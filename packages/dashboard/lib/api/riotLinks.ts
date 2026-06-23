import type { ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type RiotLinkUpdateRequest = ApiSchema<"RiotLinkUpdateRequest">;

export interface RiotLinkEntry {
    id?: number;
    discordId: string;
    summonerName: string;
    riotIdGameName?: string | null;
    riotIdTagLine?: string | null;
    region: string;
    puuid: string;
    createdAt?: string;
    updatedAt?: string;
}

export const riotLinksApi = {
    getRiotLinks: () =>
        apiRequest<{ links: RiotLinkEntry[] }>(API_ENDPOINTS.RIOT_LINKS),

    getMyRiotLink: () =>
        apiRequest<{ link: RiotLinkEntry | null }>(`${API_ENDPOINTS.RIOT_LINKS}/me`),

    updateRiotLink: (discordId: string, data: RiotLinkUpdateRequest) =>
        apiRequest<RiotLinkEntry>(
            `${API_ENDPOINTS.RIOT_LINKS}/${encodeURIComponent(discordId)}`,
            { method: "PUT", body: data },
        ),

    deleteRiotLink: (discordId: string) =>
        apiRequest<{ success: boolean }>(
            `${API_ENDPOINTS.RIOT_LINKS}/${encodeURIComponent(discordId)}`,
            { method: "DELETE" },
        ),
};
