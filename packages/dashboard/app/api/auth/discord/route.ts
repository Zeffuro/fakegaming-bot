import { NextResponse } from "next/server";
import { getDiscordOAuthUrl } from "@zeffuro/fakegaming-common";
import { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI } from "@/lib/env";

export async function GET() {
    return NextResponse.redirect(getDiscordOAuthUrl(DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI));
}