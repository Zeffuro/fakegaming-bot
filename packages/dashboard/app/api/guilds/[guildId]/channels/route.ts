import { NextRequest, NextResponse } from "next/server";
import { getDiscordGuildChannels, CACHE_KEYS, CACHE_TTL, defaultCacheManager } from "@zeffuro/fakegaming-common";
import { authenticateUser, checkGuildAccess } from "@/lib/auth/authUtils";
import type { APIChannel } from "discord-api-types/v10";
import { createSimpleLogger } from "@/lib/simpleColorLogger";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const log = createSimpleLogger("dashboard:channels-api");

export async function GET(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const authResult = await authenticateUser(req);
    if (!authResult.success) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.statusCode || 401 });
    }
    const user = authResult.user!;

    const guildAccess = await checkGuildAccess(user, guildId, req);
    if (!guildAccess.hasAccess) {
        return NextResponse.json(
            { error: guildAccess.error || "Not authorized for this guild" },
            { status: guildAccess.statusCode || 403 }
        );
    }

    try {
        const channels = await defaultCacheManager.getCachedData<APIChannel[]>(
            CACHE_KEYS.guildChannels(guildId),
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
            return NextResponse.json({ error: "Failed to fetch guild channels" }, { status: 500 });
        }

        return NextResponse.json(channels);
    } catch (error) {
        log.error({ err: error, guildId }, "Error fetching guild channels");
        return NextResponse.json({ error: "Failed to fetch guild channels" }, { status: 500 });
    }
}
