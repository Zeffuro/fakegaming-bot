import { NextResponse, NextRequest } from "next/server";
import { getDiscordOAuthUrl } from "@zeffuro/fakegaming-common";
import { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI } from "@/lib/env";

export async function GET(req: NextRequest) {
    const returnTo = req.nextUrl.searchParams.get("returnTo");
    let oauthUrl = getDiscordOAuthUrl(DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI);
    if (returnTo) {
        const sep = oauthUrl.includes("?") ? "&" : "?";
        oauthUrl = `${oauthUrl}${sep}state=${encodeURIComponent(returnTo)}`;
    }
    return NextResponse.redirect(oauthUrl);
}