import { NextResponse, NextRequest } from "next/server";
import { getDiscordOAuthUrl } from "@zeffuro/fakegaming-common";
import { getDiscordOAuthAuthorizeConfig } from "@/lib/env";
import { createDiscordOAuthState, discordOAuthCookie } from "@/lib/auth/discordOAuthState";

export async function GET(req: NextRequest) {
    const { clientId, redirectUri } = getDiscordOAuthAuthorizeConfig();
    const oauthUrl = new URL(getDiscordOAuthUrl(clientId, redirectUri));
    const { state, value } = createDiscordOAuthState(req.nextUrl.searchParams.get("returnTo"));
    oauthUrl.searchParams.set("state", state);
    const response = NextResponse.redirect(oauthUrl);
    response.cookies.set({ ...discordOAuthCookie(), value });
    return response;
}
