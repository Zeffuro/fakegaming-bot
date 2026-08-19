import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { API_ENDPOINTS, apiRequest } from './core';

export interface GuildLocaleConfigResponse {
    guildId: string;
    outputLocale: SupportedOutputLocale;
}

function guildQuery(guildId: string): string {
    return `?guildId=${encodeURIComponent(guildId)}`;
}

export const guildLocaleConfigApi = {
    getGuildLocaleConfig: (guildId: string) =>
        apiRequest<GuildLocaleConfigResponse>(`${API_ENDPOINTS.GUILD_LOCALE_CONFIG}${guildQuery(guildId)}`),

    updateGuildLocaleConfig: (guildId: string, outputLocale: SupportedOutputLocale) =>
        apiRequest<GuildLocaleConfigResponse>(`${API_ENDPOINTS.GUILD_LOCALE_CONFIG}${guildQuery(guildId)}`, {
            method: 'PUT',
            body: { outputLocale },
        }),
};
