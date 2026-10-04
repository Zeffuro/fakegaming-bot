import { createHmac, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { API_URL, getJwtConfig, PUBLIC_URL, SERVICE_API_TOKEN } from "@/lib/env";
import { authenticateUser, isDashboardAdmin } from "@/lib/auth/authUtils";
import { getRequestDashboardLocaleFromRequest, getRequestDashboardMessageFromRequest } from "@/lib/i18n/server";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@zeffuro/fakegaming-common/security";

export const TWITCH_STATE_COOKIE = "fg.twitch.state";
export const TWITCH_RETURN_COOKIE = "fg.twitch.return";
export const twitchCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/twitch",
    maxAge: 600,
};

export function twitchReturnPath(guildId: unknown): string {
    return typeof guildId === "string" && /^\d{17,20}$/.test(guildId)
        ? `/dashboard/twitch/${guildId}`
        : "/dashboard/admin/twitch";
}

export async function twitchAdminId(req: NextRequest): Promise<string | null> {
    const auth = await authenticateUser(req);
    return auth.success && auth.user && isDashboardAdmin(auth.user.discordId) ? auth.user.discordId : null;
}

export async function callTwitchAdminApi(req: NextRequest, discordId: string, action: "connect" | "complete", body: unknown): Promise<Response> {
    const requestId = `twitch-${randomUUID()}`;
    const signature = createHmac("sha256", getJwtConfig().secret).update(`${discordId}:${requestId}`).digest("hex");
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept-Language": getRequestDashboardLocaleFromRequest(req),
        "Authorization": `Bearer ${req.cookies.get("jwt")?.value ?? ""}`,
        "x-dashboard-admin-user": discordId,
        "x-dashboard-admin-request": requestId,
        "x-dashboard-admin-signature": signature,
        "x-request-id": requestId,
    };
    if (SERVICE_API_TOKEN) headers["x-service-token"] = SERVICE_API_TOKEN;
    const csrf = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (csrf) {
        headers[CSRF_HEADER_NAME] = csrf;
        headers.Cookie = `${CSRF_COOKIE_NAME}=${csrf}`;
    }
    return await fetch(`${API_URL}/twitchClips/bot/${action}`, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15_000) });
}

export function twitchOAuthError(req: NextRequest, status: number): NextResponse {
    return NextResponse.json({ error: getRequestDashboardMessageFromRequest(req, status === 403 ? "error.notAuthenticated" : "error.serviceUnavailable") }, { status });
}

export function twitchOAuthRedirect(req: NextRequest, result: "success" | "error"): NextResponse {
    const stored = req.cookies.get(TWITCH_RETURN_COOKIE)?.value;
    const match = stored?.match(/^\/dashboard\/twitch\/(\d{17,20})$/);
    const url = new URL(twitchReturnPath(match?.[1]), PUBLIC_URL);
    url.searchParams.set("twitchBot", result);
    const response = NextResponse.redirect(url);
    response.cookies.set(TWITCH_STATE_COOKIE, "", { ...twitchCookieOptions, maxAge: 0 });
    response.cookies.set(TWITCH_RETURN_COOKIE, "", { ...twitchCookieOptions, maxAge: 0 });
    return response;
}
