import { NextRequest, NextResponse } from "next/server";
import {getBaseUrl} from "@/lib/util/getBaseUrl";
import { exchangeCodeForToken, fetchDiscordUser, getDiscordGuilds, issueJwt } from "@/lib/common/discord";
import { MinimalGuildData } from "@/lib/common/models";
import { defaultCacheManager, CACHE_KEYS, CACHE_TTL } from "@/lib/common/cache";
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, JWT_SECRET, JWT_AUDIENCE } from "@/lib/env";
import type { APIGuild, APIUser } from "discord-api-types/v10";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    // Exchange code for access_token
    const tokenData = await exchangeCodeForToken(code, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI);
    if (!tokenData.access_token) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

    // Fetch user info and guilds
    const user: APIUser = await fetchDiscordUser(tokenData.access_token);
    const guilds: APIGuild[] = await getDiscordGuilds(tokenData.access_token, "Bearer");

    // Cache user profile data for dashboard use
    const userProfile = {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        global_name: user.global_name,
        avatar: user.avatar
    };
    await defaultCacheManager.set(CACHE_KEYS.userProfile(user.id), userProfile, CACHE_TTL.USER_PROFILE);

    // Cache only minimal guild info for backend logic (id, permissions, owner)
    const minimalGuilds: MinimalGuildData[] = guilds.map((guild: APIGuild): MinimalGuildData => ({
        id: guild.id,
        permissions: guild.permissions,
        owner: guild.owner
    }));
    await defaultCacheManager.set(CACHE_KEYS.userGuilds(user.id), minimalGuilds, CACHE_TTL.USER_GUILDS);

    // Store user's Discord access token in Redis for backend use
    await defaultCacheManager.set(
        CACHE_KEYS.userAccessToken(user.id),
        tokenData.access_token,
        tokenData.expires_in ? tokenData.expires_in * 1000 : CACHE_TTL.ACCESS_TOKEN
    );

    // Issue JWT with just user info
    const jwtToken = issueJwt(user, JWT_SECRET, JWT_AUDIENCE);

    // Redirect to dashboard and set JWT in httpOnly cookie
    const response = NextResponse.redirect(new URL("/dashboard", getBaseUrl(req)));
    response.cookies.set("jwt", jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // false for localhost!
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
    });
    // Removed discord_access_token cookie for security
    return response;
}
