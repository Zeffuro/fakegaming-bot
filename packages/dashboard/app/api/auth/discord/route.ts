import { NextResponse } from "next/server";
import { getDiscordOAuthUrl } from "@/lib/common/discord";
import { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI } from "@/lib/env";

export async function GET() {
    return NextResponse.redirect(getDiscordOAuthUrl(DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI));
}