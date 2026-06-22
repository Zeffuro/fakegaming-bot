import type { NextRequest } from "next/server";
import type { APIGuild } from "discord-api-types/v10";
import {
    CACHE_KEYS,
    CACHE_TTL,
    defaultCacheManager,
    getDiscordGuilds,
    refreshDiscordAccessToken,
    type MinimalGuildData
} from "@zeffuro/fakegaming-common";
import { getDiscordOAuthConfig } from "@/lib/env";
import { getRefreshSession, updateRefreshSession } from "@/lib/auth/refreshSessions";
import { REFRESH_SESSION_COOKIE_NAME } from "@/lib/auth/sessionConstants";
import { createSimpleLogger } from "@/lib/simpleColorLogger";

const log = createSimpleLogger("dashboard:guild-cache");

export function toMinimalGuilds(guilds: APIGuild[]): MinimalGuildData[] {
    return guilds.map((guild: APIGuild): MinimalGuildData => ({
        id: guild.id,
        permissions: guild.permissions,
        owner: guild.owner
    }));
}

export async function getUserAccessToken(req: NextRequest, userId: string): Promise<string | null> {
    const cachedAccessToken = await defaultCacheManager.get<string>(CACHE_KEYS.userAccessToken(userId));
    if (cachedAccessToken) {
        return cachedAccessToken;
    }

    const refreshToken = req.cookies.get(REFRESH_SESSION_COOKIE_NAME)?.value;
    const refreshSession = await getRefreshSession(refreshToken);
    if (!refreshSession?.discordRefreshToken || refreshSession.user.id !== userId) {
        return null;
    }

    const { clientId, clientSecret } = getDiscordOAuthConfig();
    const tokenData = await refreshDiscordAccessToken(
        refreshSession.discordRefreshToken,
        clientId,
        clientSecret
    );

    if (!tokenData.access_token) {
        return null;
    }

    try {
        await defaultCacheManager.set(
            CACHE_KEYS.userAccessToken(userId),
            tokenData.access_token,
            tokenData.expires_in ? tokenData.expires_in * 1000 : CACHE_TTL.ACCESS_TOKEN
        );
    } catch (error) {
        log.warn({ err: error, userId }, "Failed to cache refreshed Discord access token");
    }

    if (tokenData.refresh_token) {
        try {
            await updateRefreshSession(refreshToken, {
                discordRefreshToken: tokenData.refresh_token
            });
        } catch (error) {
            log.warn({ err: error, userId }, "Failed to persist rotated Discord refresh token");
        }
    }

    return tokenData.access_token;
}

export async function fetchUserGuilds(req: NextRequest, userId: string): Promise<MinimalGuildData[]> {
    const userAccessToken = await getUserAccessToken(req, userId);
    if (!userAccessToken) {
        throw new Error("Discord authorization expired");
    }

    const guilds = await getDiscordGuilds(userAccessToken, "Bearer") as APIGuild[];
    return toMinimalGuilds(guilds);
}

export async function getUserGuilds(req: NextRequest, userId: string, forceRefresh: boolean): Promise<MinimalGuildData[] | null> {
    const key = CACHE_KEYS.userGuilds(userId);

    if (!forceRefresh) {
        try {
            const cachedGuilds = await defaultCacheManager.get<MinimalGuildData[]>(key);
            if (cachedGuilds) {
                return cachedGuilds;
            }
        } catch (error) {
            log.warn({ err: error, userId }, "Failed to read cached Discord guilds");
        }
    }

    const freshGuilds = await fetchUserGuilds(req, userId);

    try {
        await defaultCacheManager.set(key, freshGuilds, CACHE_TTL.USER_GUILDS);
    } catch (error) {
        log.warn({ err: error, userId }, "Failed to cache refreshed Discord guilds");
    }

    return freshGuilds;
}
