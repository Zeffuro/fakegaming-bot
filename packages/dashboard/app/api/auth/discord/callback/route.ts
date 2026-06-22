import { NextRequest, NextResponse } from "next/server";
import {getBaseUrl} from "@/lib/util/getBaseUrl";
import { exchangeCodeForToken, fetchDiscordUser, getDiscordGuilds, issueJwt, CACHE_KEYS, CACHE_TTL, defaultCacheManager, type MinimalGuildData } from "@zeffuro/fakegaming-common";
import { getDiscordOAuthConfig, getJwtConfig } from "@/lib/env";
import { generateCsrfToken, setCsrfCookie } from "@/lib/security/csrf";
import type { APIGuild, APIUser } from "discord-api-types/v10";
import { sanitizeReturnTo } from "@/lib/util/sanitizeReturnTo";
import { createRefreshSession } from "@/lib/auth/refreshSessions";
import {
    ACCESS_TOKEN_COOKIE_NAME,
    ACCESS_TOKEN_MAX_AGE_SECONDS,
    REFRESH_SESSION_COOKIE_NAME,
    REFRESH_SESSION_IDLE_MAX_AGE_SECONDS
} from "@/lib/auth/sessionConstants";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    const { clientId, clientSecret, redirectUri } = getDiscordOAuthConfig();
    const { secret, audience, issuer } = getJwtConfig();
    const tokenData = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
    if (!tokenData.access_token) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

    const user: APIUser = await fetchDiscordUser(tokenData.access_token);
    const guilds: APIGuild[] = await getDiscordGuilds(tokenData.access_token, "Bearer");

    const userProfile = {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        global_name: user.global_name,
        avatar: user.avatar
    };
    await defaultCacheManager.set(CACHE_KEYS.userProfile(user.id), userProfile, CACHE_TTL.USER_PROFILE);

    const minimalGuilds: MinimalGuildData[] = guilds.map((guild: APIGuild): MinimalGuildData => ({
        id: guild.id,
        permissions: guild.permissions,
        owner: guild.owner
    }));
    await defaultCacheManager.set(CACHE_KEYS.userGuilds(user.id), minimalGuilds, CACHE_TTL.USER_GUILDS);

    await defaultCacheManager.set(
        CACHE_KEYS.userAccessToken(user.id),
        tokenData.access_token,
        tokenData.expires_in ? tokenData.expires_in * 1000 : CACHE_TTL.ACCESS_TOKEN
    );

    const jwtToken = issueJwt(userProfile, secret, audience, issuer, {
        expiresIn: ACCESS_TOKEN_MAX_AGE_SECONDS
    });
    const refreshSession = await createRefreshSession({
        user: userProfile,
        discordRefreshToken: tokenData.refresh_token ?? null
    });

    const rawState = req.nextUrl.searchParams.get("state");
    const returnTo = sanitizeReturnTo(rawState) || "/dashboard";
    const response = NextResponse.redirect(new URL(returnTo, getBaseUrl(req)));
    response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    });
    response.cookies.set(REFRESH_SESSION_COOKIE_NAME, refreshSession.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: REFRESH_SESSION_IDLE_MAX_AGE_SECONDS,
    });

    const csrfToken = generateCsrfToken();
    setCsrfCookie(response, csrfToken);

    return response;
}
