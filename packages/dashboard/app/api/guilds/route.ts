import {NextRequest, NextResponse} from "next/server";
import jwt from "jsonwebtoken";
import { getCache, setCache } from "@/lib/cache";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const DASHBOARD_ADMINS = (process.env.DASHBOARD_ADMINS || "").split(",").map(id => id.trim()).filter(Boolean);

const BOT_GUILDS_CACHE_KEY = "bot_guilds";
const BOT_GUILDS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const USER_GUILDS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Helper: fetch guilds from Discord API with rate limit handling
async function fetchGuilds(endpoint: string, token: string, maxRetries = 3): Promise<any[]> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const res = await fetch(`https://discord.com/api/v10${endpoint}`, {
            headers: { Authorization: `Bot ${token}` },
        });
        if (res.status === 429) {
            const errorBody = await res.json();
            const retryAfter = errorBody.retry_after ? Number(errorBody.retry_after) * 1000 : 1000;
            console.warn(`Discord rate limited for ${endpoint}, retrying after ${retryAfter}ms (attempt ${attempt + 1})`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
        }
        if (!res.ok) {
            const errorBody = await res.text();
            console.error(`Discord API error for ${endpoint}: status ${res.status}, body:`, errorBody);
            return [];
        }
        return await res.json();
    }
    console.error(`Discord API rate limit exceeded for ${endpoint} after ${maxRetries} attempts.`);
    return [];
}

export async function GET(req: NextRequest) {
    // Get JWT from cookie
    const jwtToken = req.cookies.get("jwt")?.value;
    if (!jwtToken) {
        // Redirect to root if not authenticated
        return NextResponse.redirect(new URL("/", req.url));
    }
    let user;
    try {
        user = jwt.verify(jwtToken, JWT_SECRET) as { id: string };
    } catch {
        // Redirect to root if token is invalid
        return NextResponse.redirect(new URL("/", req.url));
    }

    // Fetch bot's guilds with cache utility
    let botGuilds: any[] = [];
    let cachedBotGuilds = await getCache(BOT_GUILDS_CACHE_KEY);
    if (cachedBotGuilds) {
        botGuilds = cachedBotGuilds;
    } else {
        botGuilds = await fetchGuilds("/users/@me/guilds", BOT_TOKEN);
        await setCache(BOT_GUILDS_CACHE_KEY, botGuilds, BOT_GUILDS_CACHE_TTL);
    }

    // If user is in admin array, return all bot guilds
    if (DASHBOARD_ADMINS.includes(user.id)) {
        return NextResponse.json({guilds: botGuilds, isAdmin: true});
    }

    // Fetch user's guilds with per-user cache utility
    let userGuilds = [];
    const userGuildsCacheKey = `user_guilds:${user.id}`;
    let cachedUserGuilds = await getCache(userGuildsCacheKey);
    if (cachedUserGuilds) {
        userGuilds = cachedUserGuilds;
    } else {
        const userAccessToken = req.cookies.get("discord_access_token")?.value || "";
        if (userAccessToken) {
            userGuilds = await fetchGuilds("/users/@me/guilds", userAccessToken);
            await setCache(userGuildsCacheKey, userGuilds, USER_GUILDS_CACHE_TTL);
        }
    }
    if (!userGuilds.length) {
        return NextResponse.json({guilds: []});
    }

    // Filter: shared guilds or user has admin perms (0x8)
    const sharedGuilds = botGuilds.filter((botGuild: any) =>
        userGuilds.some((userGuild: any) =>
            userGuild.id === botGuild.id && (userGuild.owner || (userGuild.permissions & 0x8))
        )
    );

    return NextResponse.json({guilds: sharedGuilds, isAdmin: false});
}
