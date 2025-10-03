import {NextRequest, NextResponse} from "next/server";
import { getDiscordGuilds } from "@/lib/common/discord";
import { MinimalGuildData } from "@/lib/common/models";
import { isGuildAdmin } from "@/lib/common/utils";
import { CACHE_KEYS, CACHE_TTL, getCachedData } from "@/lib/common/cache";
import { authenticateUser, isDashboardAdmin } from "@/lib/auth/authUtils";
import type { APIGuild } from "discord-api-types/v10";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";

export async function GET(req: NextRequest) {
    // Authenticate user
    const authResult = await authenticateUser(req);
    if (!authResult.success) {
        return NextResponse.redirect(new URL("/", req.url));
    }
    const user = authResult.user!;

    try {
        // Fetch bot's guilds with improved cache management
        const botGuilds = await getCachedData(
            CACHE_KEYS.botGuilds(),
            async () => {
                if (!BOT_TOKEN) {
                    console.error("[Discord Bot] DISCORD_BOT_TOKEN is not set!");
                    throw new Error("Bot token not configured");
                }
                console.log("[Discord Bot] Using bot token:", BOT_TOKEN ? BOT_TOKEN.slice(0, 8) + "...(masked)" : "EMPTY");

                return await getDiscordGuilds(BOT_TOKEN, "Bot");
            },
            CACHE_TTL.BOT_GUILDS
        );

        if (!botGuilds) {
            return NextResponse.json({ error: "Failed to fetch bot guilds" }, { status: 500 });
        }

        // If user is admin, return all bot guilds
        if (isDashboardAdmin(user.discordId)) {
            return NextResponse.json({guilds: botGuilds, isAdmin: true});
        }

        // Fetch user's guilds with improved cache management
        const userGuilds = await getCachedData(
            CACHE_KEYS.userGuilds(user.discordId),
            async () => {
                // Get user's Discord access token from Redis using getCachedData
                const userAccessToken = await getCachedData(
                    CACHE_KEYS.userAccessToken(user.discordId),
                    async () => {
                        // This should never happen since we'd need the token to be already in cache
                        // But we need to provide a fetchFn for getCachedData
                        console.error("[Discord User] Trying to fetch non-existent access token for user", user.discordId);
                        throw new Error("User access token not found in cache");
                    },
                    CACHE_TTL.ACCESS_TOKEN
                );

                if (!userAccessToken) {
                    console.error("[Discord User] No access token found in Redis for user", user.discordId);
                    throw new Error("User access token missing");
                }

                // Fetch fresh guild data from Discord API
                const guilds = await getDiscordGuilds(userAccessToken as string, "Bearer");
                // Return only necessary data to reduce cache size
                return guilds.map((g: APIGuild): MinimalGuildData => ({
                    id: g.id,
                    permissions: g.permissions,
                    owner: g.owner
                }));
            },
            CACHE_TTL.USER_GUILDS
        );

        if (!userGuilds || !userGuilds.length) {
            return NextResponse.json({guilds: []});
        }

        // Filter: shared guilds where user has admin perms
        const sharedGuilds = botGuilds.filter((botGuild: APIGuild) =>
            userGuilds.some((userGuild: MinimalGuildData) =>
                userGuild.id === botGuild.id && isGuildAdmin([userGuild], userGuild.id)
            )
        );

        return NextResponse.json({guilds: sharedGuilds, isAdmin: false});
    } catch (error: any) {
        console.error("[Guilds API] Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process guild data" }, { status: 500 });
    }
}
