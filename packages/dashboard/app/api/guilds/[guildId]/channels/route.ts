import { NextRequest, NextResponse } from "next/server";
import { getDiscordGuildChannels, CACHE_KEYS, CACHE_TTL, defaultCacheManager } from "@zeffuro/fakegaming-common";
import { authenticateUser, checkGuildAccess } from "@/lib/auth/authUtils";
import type { APIChannel } from "discord-api-types/v10";
import { createSimpleLogger } from "@/lib/simpleColorLogger";
import { getRequestDashboardMessageFromRequest } from "@/lib/i18n/server";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const log = createSimpleLogger("dashboard:channels-api");

export async function GET(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const forceRefresh = isRefreshRequest(req);

    const authResult = await authenticateUser(req);
    if (!authResult.success) {
        return NextResponse.json({ error: getRequestDashboardMessageFromRequest(req, "error.invalidSession") }, { status: authResult.statusCode || 401 });
    }
    const user = authResult.user!;

    const guildAccess = await checkGuildAccess(user, guildId, req);
    if (!guildAccess.hasAccess) {
        return NextResponse.json(
            { error: getRequestDashboardMessageFromRequest(req, "error.guildForbidden") },
            { status: guildAccess.statusCode || 403 }
        );
    }

    try {
        const cacheKey = CACHE_KEYS.guildChannels(guildId);
        if (forceRefresh) {
            await defaultCacheManager.del(cacheKey);
            log.debug({ guildId }, "Cleared guild channel cache before refresh");
        }

        const channels = await defaultCacheManager.getCachedData<APIChannel[]>(
            cacheKey,
            async () => {
                if (!BOT_TOKEN) {
                    throw new Error("Discord bot token not configured");
                }

                log.debug({ guildId }, "Cache miss for guild channels, fetching fresh data");
                return await getDiscordGuildChannels(guildId, BOT_TOKEN);
            },
            CACHE_TTL.GUILD_CHANNELS
        );

        if (!channels) {
            return NextResponse.json({ error: getRequestDashboardMessageFromRequest(req, "error.channelsUnavailable") }, { status: 500 });
        }

        return NextResponse.json(channels);
    } catch (error) {
        log.error({ err: error, guildId }, "Error fetching guild channels");
        return NextResponse.json({ error: getRequestDashboardMessageFromRequest(req, "error.channelsUnavailable") }, { status: 500 });
    }
}

function isRefreshRequest(req: NextRequest): boolean {
    const value = req.nextUrl.searchParams.get("refresh");
    return value === "1" || value === "true";
}
