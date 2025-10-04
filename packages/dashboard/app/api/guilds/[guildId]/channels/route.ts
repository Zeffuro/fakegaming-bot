import { NextRequest, NextResponse } from "next/server";
import { getDiscordGuildChannels } from "@/lib/common/discord";
import { CACHE_KEYS, CACHE_TTL, defaultCacheManager } from "@/lib/common/cache";
import { authenticateUser, checkGuildAccess } from "@/lib/auth/authUtils";
import type { APIChannel } from "discord-api-types/v10";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    // Authenticate user
    const authResult = await authenticateUser(req);
    if (!authResult.success) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.statusCode || 401 });
    }
    const user = authResult.user!;

    // Check guild access
    const guildAccess = await checkGuildAccess(user, guildId);
    if (!guildAccess.hasAccess) {
        return NextResponse.json(
            { error: guildAccess.error || "Not authorized for this guild" },
            { status: guildAccess.statusCode || 403 }
        );
    }

    try {
        // Use improved cache management for channels
        const channels = await defaultCacheManager.getCachedData<APIChannel[]>(
            CACHE_KEYS.guildChannels(guildId),
            async () => {
                if (!BOT_TOKEN) {
                    throw new Error("Discord bot token not configured");
                }

                console.log(`[Channels API] Cache miss for guild ${guildId}, fetching fresh channel data`);
                return await getDiscordGuildChannels(guildId, BOT_TOKEN);
            },
            CACHE_TTL.GUILD_CHANNELS
        );

        if (!channels) {
            return NextResponse.json({ error: "Failed to fetch guild channels" }, { status: 500 });
        }

        return NextResponse.json(channels);
    } catch (error) {
        console.error(`[Channels API] Error fetching guild channels for ${guildId}:`, error);
        return NextResponse.json({ error: "Failed to fetch guild channels" }, { status: 500 });
    }
}
