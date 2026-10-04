import { NextRequest, NextResponse } from "next/server";
import { enforceCsrf } from "@/lib/security/csrf";
import { callTwitchAdminApi, TWITCH_RETURN_COOKIE, TWITCH_STATE_COOKIE, twitchAdminId, twitchCookieOptions, twitchOAuthError, twitchReturnPath } from "@/lib/auth/twitchOAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const csrfFailure = enforceCsrf(req);
    if (csrfFailure) return csrfFailure;
    const adminId = await twitchAdminId(req);
    if (!adminId) return twitchOAuthError(req, 403);
    try {
        const body: unknown = await req.json();
        const guildId = typeof body === "object" && body !== null && "guildId" in body ? body.guildId : undefined;
        const upstream = await callTwitchAdminApi(req, adminId, "connect", {});
        if (!upstream.ok) return twitchOAuthError(req, upstream.status);
        const result: unknown = await upstream.json();
        if (typeof result !== "object" || result === null || !("url" in result) || !("state" in result)
            || typeof result.url !== "string" || typeof result.state !== "string" || !result.state) {
            return twitchOAuthError(req, 502);
        }
        const authorizeUrl = new URL(result.url);
        if (authorizeUrl.origin !== "https://id.twitch.tv" || authorizeUrl.pathname !== "/oauth2/authorize") return twitchOAuthError(req, 502);
        const response = NextResponse.json({ url: authorizeUrl.href });
        response.cookies.set(TWITCH_STATE_COOKIE, result.state, twitchCookieOptions);
        response.cookies.set(TWITCH_RETURN_COOKIE, twitchReturnPath(guildId), twitchCookieOptions);
        return response;
    } catch {
        return twitchOAuthError(req, 502);
    }
}
