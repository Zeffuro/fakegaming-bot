import { NextRequest, NextResponse } from "next/server";
import { issueJwt } from "@zeffuro/fakegaming-common";
import { JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER } from "@/lib/env";
import { enforceCsrf, generateCsrfToken, setCsrfCookie } from "@/lib/security/csrf";
import { rotateRefreshSession, revokeRefreshSession } from "@/lib/auth/refreshSessions";
import {
    ACCESS_TOKEN_COOKIE_NAME,
    ACCESS_TOKEN_MAX_AGE_SECONDS,
    REFRESH_SESSION_COOKIE_NAME,
    REFRESH_SESSION_IDLE_MAX_AGE_SECONDS
} from "@/lib/auth/sessionConstants";

/**
 * POST /api/auth/refresh
 * Rotates the refresh session and issues a new short-lived access JWT.
 */
export async function POST(req: NextRequest) {
    const csrfFailure = enforceCsrf(req);
    if (csrfFailure) return csrfFailure;

    const oldRefreshToken = req.cookies.get(REFRESH_SESSION_COOKIE_NAME)?.value;
    const rotated = await rotateRefreshSession(oldRefreshToken);

    if (!rotated) {
        await revokeRefreshSession(oldRefreshToken);
        const res = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        res.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", {
            path: "/",
            expires: new Date(0),
        });
        res.cookies.set(REFRESH_SESSION_COOKIE_NAME, "", {
            path: "/",
            expires: new Date(0),
        });
        return res;
    }

    const newToken = issueJwt(rotated.record.user, JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER, {
        expiresIn: ACCESS_TOKEN_MAX_AGE_SECONDS
    });
    const res = NextResponse.json({ refreshed: true });
    res.cookies.set(ACCESS_TOKEN_COOKIE_NAME, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    });
    res.cookies.set(REFRESH_SESSION_COOKIE_NAME, rotated.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: REFRESH_SESSION_IDLE_MAX_AGE_SECONDS,
    });

    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
    return res;
}
