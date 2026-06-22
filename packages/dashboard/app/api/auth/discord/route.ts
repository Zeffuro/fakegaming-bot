import { NextResponse, NextRequest } from "next/server";
import { getDiscordOAuthUrl } from "@zeffuro/fakegaming-common";
import { getDiscordOAuthAuthorizeConfig } from "@/lib/env";

export async function GET(req: NextRequest) {
    const returnTo = req.nextUrl.searchParams.get("returnTo");
    const { clientId, redirectUri } = getDiscordOAuthAuthorizeConfig();
    let oauthUrl = getDiscordOAuthUrl(clientId, redirectUri);
    if (returnTo) {
        const sep = oauthUrl.includes("?") ? "&" : "?";
        oauthUrl = `${oauthUrl}${sep}state=${encodeURIComponent(returnTo)}`;
    }
    return NextResponse.redirect(oauthUrl);
}
