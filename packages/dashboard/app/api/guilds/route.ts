import {NextRequest, NextResponse} from "next/server";
import jwt from "jsonwebtoken";
import { cacheGet, cacheSet, fetchDiscordGuilds } from "@zeffuro/fakegaming-common";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const DASHBOARD_ADMINS = (process.env.DASHBOARD_ADMINS || "").split(",").map(id => id.trim()).filter(Boolean);

const BOT_GUILDS_CACHE_KEY = "bot_guilds";
const BOT_GUILDS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const USER_GUILDS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
    // Get JWT from cookie
    const jwtToken = req.cookies.get("jwt")?.value;
    if (!jwtToken) {
        // Redirect to root if not authenticated
        return NextResponse.redirect(new URL("/", req.url));
    }
    let user;
    try {
        user = jwt.verify(jwtToken, JWT_SECRET) as { discordId: string };
    } catch {
        // Redirect to root if token is invalid
        return NextResponse.redirect(new URL("/", req.url));
    }

    // Fetch bot's guilds with cache utility
    let botGuilds: any[] = [];
    let cachedBotGuilds = await cacheGet(BOT_GUILDS_CACHE_KEY);
    if (cachedBotGuilds) {
        botGuilds = cachedBotGuilds;
    } else {
        if (!BOT_TOKEN) {
            console.error("[Discord Bot] DISCORD_BOT_TOKEN is not set!");
            return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
        }
        console.log("[Discord Bot] Using bot token:", BOT_TOKEN ? BOT_TOKEN.slice(0, 8) + "...(masked)" : "EMPTY");
        try {
            botGuilds = await fetchDiscordGuilds(BOT_TOKEN, "Bot");
            await cacheSet(BOT_GUILDS_CACHE_KEY, botGuilds, BOT_GUILDS_CACHE_TTL);
        } catch (err: any) {
            console.error("[Discord Bot] Failed to fetch bot guilds:", err.message);
            return NextResponse.json({ error: "Failed to fetch bot guilds", details: err.message }, { status: 500 });
        }
    }

    // If user is in admin array, return all bot guilds
    if (DASHBOARD_ADMINS.includes(user.discordId)) {
        return NextResponse.json({guilds: botGuilds, isAdmin: true});
    }

    // Fetch user's guilds with per-user cache utility
    let userGuilds: any[] = [];
    const userGuildsCacheKey = `user:${user.discordId}:guilds`;
    let cachedUserGuilds = await cacheGet(userGuildsCacheKey);
    if (cachedUserGuilds) {
        userGuilds = cachedUserGuilds;
    } else {
        // Get user's Discord access token from Redis
        const userAccessToken = await cacheGet(`user:${user.discordId}:access_token`);
        if (!userAccessToken) {
            console.error("[Discord User] No access token found in Redis for user", user.discordId);
            return NextResponse.json({ error: "User access token missing" }, { status: 401 });
        }
        try {
            userGuilds = await fetchDiscordGuilds(userAccessToken, "Bearer");
            userGuilds = userGuilds.map(g => ({ id: g.id, permissions: g.permissions, owner: g.owner }));
            await cacheSet(userGuildsCacheKey, userGuilds, USER_GUILDS_CACHE_TTL);
        } catch (err: any) {
            console.error("[Discord User] Failed to fetch user guilds:", err.message);
            return NextResponse.json({ error: "Failed to fetch user guilds", details: err.message }, { status: 401 });
        }
    }
    if (!userGuilds.length) {
        return NextResponse.json({guilds: []});
    }

    // Filter: shared guilds or user has admin perms (0x8)
    // userGuilds only has id, permissions, owner now
    const sharedGuilds = botGuilds.filter((botGuild: any) =>
        userGuilds.some((userGuild: any) =>
            userGuild.id === botGuild.id && (userGuild.owner || (userGuild.permissions && 0x8))
        )
    );

    return NextResponse.json({guilds: sharedGuilds, isAdmin: false});
}
