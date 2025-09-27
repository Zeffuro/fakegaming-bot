import {NextRequest, NextResponse} from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DASHBOARD_ADMINS = (process.env.DASHBOARD_ADMINS || "").split(",").map(id => id.trim()).filter(Boolean);

// Helper: fetch guilds from Discord API
async function fetchGuilds(endpoint: string, token: string) {
    const res = await fetch(`https://discord.com/api/v10${endpoint}`, {
        headers: {Authorization: `Bot ${token}`},
    });
    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Discord API error for ${endpoint}: status ${res.status}, body:`, errorBody);
        return [];
    }
    return await res.json();
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

    // Fetch bot's guilds
    if (!BOT_TOKEN) {
        console.error("DISCORD_BOT_TOKEN is not set in environment");
        return NextResponse.json({error: "Bot token not configured"}, {status: 500});
    }

    let botGuilds = [];
    try {
        botGuilds = await fetchGuilds("/users/@me/guilds", BOT_TOKEN);
    } catch (err) {
        console.error("Error fetching bot guilds:", err);
        return NextResponse.json({error: "Failed to fetch bot guilds"}, {status: 500});
    }

    // If user is in admin array, return all bot guilds
    if (DASHBOARD_ADMINS.includes(user.id)) {
        return NextResponse.json({guilds: botGuilds, isAdmin: true});
    }

    // Fetch user's guilds (if you want to support this, you must store user's Discord access token in a cookie)
    let userGuilds = [];
    try {
        const userAccessToken = req.cookies.get("discord_access_token")?.value || "";
        if (userAccessToken) {
            userGuilds = await fetchGuilds("/users/@me/guilds", userAccessToken);
        }
    } catch (err) {
        console.error("Error fetching user guilds:", err);
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
