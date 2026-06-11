import {NextRequest, NextResponse} from "next/server";
import {
    getDiscordGuilds,
    refreshDiscordAccessToken,
    type MinimalGuildData,
    isGuildAdmin,
    CACHE_KEYS,
    CACHE_TTL,
    getCachedData,
    defaultCacheManager
} from "@zeffuro/fakegaming-common";
import { authenticateUser, isDashboardAdmin } from "@/lib/auth/authUtils";
import type { APIGuild } from "discord-api-types/v10";
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } from "@/lib/env";
import { getRefreshSession, updateRefreshSession } from "@/lib/auth/refreshSessions";
import { REFRESH_SESSION_COOKIE_NAME } from "@/lib/auth/sessionConstants";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";

function toMinimalGuilds(guilds: APIGuild[]): MinimalGuildData[] {
    return guilds.map((guild: APIGuild): MinimalGuildData => ({
        id: guild.id,
        permissions: guild.permissions,
        owner: guild.owner
    }));
}

async function fetchBotGuilds(): Promise<APIGuild[]> {
    if (!BOT_TOKEN) {
        console.error("[Discord Bot] DISCORD_BOT_TOKEN is not set!");
        throw new Error("Bot token not configured");
    }

    return await getDiscordGuilds(BOT_TOKEN, "Bot") as APIGuild[];
}

async function getBotGuilds(forceRefresh: boolean): Promise<APIGuild[] | null> {
    if (forceRefresh) {
        const freshGuilds = await fetchBotGuilds();
        await defaultCacheManager.set(CACHE_KEYS.botGuilds(), freshGuilds, CACHE_TTL.BOT_GUILDS);
        return freshGuilds;
    }

    return await getCachedData(
        CACHE_KEYS.botGuilds(),
        fetchBotGuilds,
        CACHE_TTL.BOT_GUILDS
    );
}

async function getUserAccessToken(req: NextRequest, userId: string): Promise<string | null> {
    const cachedAccessToken = await defaultCacheManager.get<string>(CACHE_KEYS.userAccessToken(userId));
    if (cachedAccessToken) {
        return cachedAccessToken;
    }

    const refreshToken = req.cookies.get(REFRESH_SESSION_COOKIE_NAME)?.value;
    const refreshSession = await getRefreshSession(refreshToken);
    if (!refreshSession?.discordRefreshToken || refreshSession.user.id !== userId) {
        return null;
    }

    const tokenData = await refreshDiscordAccessToken(
        refreshSession.discordRefreshToken,
        DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET
    );

    if (!tokenData.access_token) {
        return null;
    }

    await defaultCacheManager.set(
        CACHE_KEYS.userAccessToken(userId),
        tokenData.access_token,
        tokenData.expires_in ? tokenData.expires_in * 1000 : CACHE_TTL.ACCESS_TOKEN
    );

    if (tokenData.refresh_token) {
        await updateRefreshSession(refreshToken, {
            discordRefreshToken: tokenData.refresh_token
        });
    }

    return tokenData.access_token;
}

async function fetchUserGuilds(req: NextRequest, userId: string): Promise<MinimalGuildData[]> {
    const userAccessToken = await getUserAccessToken(req, userId);
    if (!userAccessToken) {
        throw new Error("Discord authorization expired");
    }

    const guilds = await getDiscordGuilds(userAccessToken, "Bearer") as APIGuild[];
    return toMinimalGuilds(guilds);
}

async function getUserGuilds(req: NextRequest, userId: string, forceRefresh: boolean): Promise<MinimalGuildData[] | null> {
    if (forceRefresh) {
        const freshGuilds = await fetchUserGuilds(req, userId);
        await defaultCacheManager.set(CACHE_KEYS.userGuilds(userId), freshGuilds, CACHE_TTL.USER_GUILDS);
        return freshGuilds;
    }

    return await getCachedData(
        CACHE_KEYS.userGuilds(userId),
        () => fetchUserGuilds(req, userId),
        CACHE_TTL.USER_GUILDS
    );
}

export async function GET(req: NextRequest) {
    const authResult = await authenticateUser(req);
    if (!authResult.success) {
        return NextResponse.json({ error: authResult.error ?? "Not authenticated" }, { status: authResult.statusCode ?? 401 });
    }
    const user = authResult.user!;
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

    try {
        const botGuilds = await getBotGuilds(forceRefresh);

        if (!botGuilds) {
            return NextResponse.json({ error: "Failed to fetch bot guilds" }, { status: 500 });
        }

        if (isDashboardAdmin(user.discordId)) {
            return NextResponse.json({guilds: botGuilds, isAdmin: true});
        }

        const userGuilds = await getUserGuilds(req, user.discordId, forceRefresh);

        if (!userGuilds || !userGuilds.length) {
            return NextResponse.json({guilds: []});
        }

        const sharedGuilds = botGuilds.filter((botGuild: APIGuild) =>
            userGuilds.some((userGuild: MinimalGuildData) =>
                userGuild.id === botGuild.id && isGuildAdmin([userGuild], userGuild.id)
            )
        );

        return NextResponse.json({guilds: sharedGuilds, isAdmin: false});
    } catch (error: unknown) {
        console.error("[Guilds API] Error:", error);
        const message = error instanceof Error ? error.message : "Failed to process guild data";
        const status = message === "Discord authorization expired" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
