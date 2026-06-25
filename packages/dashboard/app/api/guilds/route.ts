import {NextRequest, NextResponse} from "next/server";
import {
    getDiscordGuilds,
    isGuildAdmin,
    CACHE_KEYS,
    CACHE_TTL,
    getCachedData,
    defaultCacheManager,
    type MinimalGuildData
} from "@zeffuro/fakegaming-common";
import { authenticateUser, isDashboardAdmin } from "@/lib/auth/authUtils";
import type { APIGuild } from "discord-api-types/v10";
import { createSimpleLogger } from "@/lib/simpleColorLogger";
import { getUserGuilds } from "@/lib/auth/discordGuildCache";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const log = createSimpleLogger("dashboard:guilds-api");

async function fetchBotGuilds(): Promise<APIGuild[]> {
    if (!BOT_TOKEN) {
        log.error(undefined, "DISCORD_BOT_TOKEN is not set");
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
        log.error({ err: error }, "Error fetching guild data");
        const message = error instanceof Error ? error.message : "Failed to process guild data";
        const status = getGuildDataErrorStatus(message);
        return NextResponse.json({
            error: {
                code: status === 401 ? "DISCORD_AUTHORIZATION_EXPIRED" : status === 503 ? "GUILD_ACCESS_UNAVAILABLE" : "GUILD_DATA_UNAVAILABLE",
                message,
                recovery: status === 503 ? "Refresh the dashboard session, then retry the request." : undefined,
            },
        }, { status });
    }
}

function getGuildDataErrorStatus(message: string): number {
    if (message === "Discord authorization expired") return 401;
    const normalized = message.toLowerCase();
    if (normalized.includes("redis") || normalized.includes("cache") || normalized.includes("guild access")) {
        return 503;
    }
    return 500;
}
