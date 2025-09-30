import { NextRequest, NextResponse } from "next/server";
import {getBaseUrl} from "@/lib/util/getBaseUrl";
import { exchangeCodeForToken, fetchDiscordUser, fetchDiscordGuilds, issueJwt } from "@zeffuro/fakegaming-common";
import { cacheSet } from "@zeffuro/fakegaming-common";
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, JWT_SECRET, JWT_AUDIENCE } from "@/lib/env";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    // Exchange code for access_token
    const tokenData = await exchangeCodeForToken(code, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI);
    if (!tokenData.access_token) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

    // Fetch user info and guilds
    const user = await fetchDiscordUser(tokenData.access_token);
    const guilds = await fetchDiscordGuilds(tokenData.access_token, "Bearer");

    // Cache only minimal guild info for backend logic (id, permissions, owner)
    const minimalGuilds = guilds.map(g => ({ id: g.id, permissions: g.permissions, owner: g.owner }));
    await cacheSet(`user:${user.id}:guilds`, minimalGuilds, 10 * 60 * 1000);

    // Store user's Discord access token in Redis for backend use
    await cacheSet(`user:${user.id}:access_token`, tokenData.access_token, tokenData.expires_in ? tokenData.expires_in * 1000 : 3600 * 1000);

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
