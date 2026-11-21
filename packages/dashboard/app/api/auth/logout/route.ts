import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/util/getBaseUrl";
import { revokeRefreshSession } from "@/lib/auth/refreshSessions";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_SESSION_COOKIE_NAME } from "@/lib/auth/sessionConstants";
import { CSRF_COOKIE_NAME } from "@/lib/security/csrf";
import { getRequestDashboardMessageFromRequest } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
    try { await revokeRefreshSession(req.cookies.get(REFRESH_SESSION_COOKIE_NAME)?.value); }
    catch { return NextResponse.json({ error: getRequestDashboardMessageFromRequest(req, "error.serviceUnavailable") }, { status: 503 }); }

    const response = NextResponse.redirect(`${getBaseUrl(req)}/`);

    for (const name of [ACCESS_TOKEN_COOKIE_NAME, REFRESH_SESSION_COOKIE_NAME, CSRF_COOKIE_NAME]) {
        response.cookies.set({
            name,
            value: "",
            path: "/",
            expires: new Date(0),
            sameSite: "lax",
        });
    }

    return response;
}
