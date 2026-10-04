import type { NextRequest } from "next/server";
import { callTwitchAdminApi, TWITCH_STATE_COOKIE, twitchAdminId, twitchOAuthRedirect } from "@/lib/auth/twitchOAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const state = req.nextUrl.searchParams.get("state");
    const code = req.nextUrl.searchParams.get("code");
    if (!state || !code || state !== req.cookies.get(TWITCH_STATE_COOKIE)?.value || req.nextUrl.searchParams.has("error")) {
        return twitchOAuthRedirect(req, "error");
    }
    try {
        const adminId = await twitchAdminId(req);
        if (!adminId) return twitchOAuthRedirect(req, "error");
        const upstream = await callTwitchAdminApi(req, adminId, "complete", { code, state });
        if (!upstream.ok) return twitchOAuthRedirect(req, "error");
        const result: unknown = await upstream.json();
        const success = typeof result === "object" && result !== null && "success" in result && result.success === true;
        return twitchOAuthRedirect(req, success ? "success" : "error");
    } catch {
        return twitchOAuthRedirect(req, "error");
    }
}
