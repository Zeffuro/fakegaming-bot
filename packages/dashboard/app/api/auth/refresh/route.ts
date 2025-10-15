import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, issueJwt } from "@zeffuro/fakegaming-common";
import { JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER } from "@/lib/env";
import { enforceCsrf, generateCsrfToken, setCsrfCookie } from "@/lib/security/csrf.js";

/**
 * POST /api/auth/refresh
 * Re-issues short-lived session JWT (rolling session) if current token valid.
 */
export async function POST(req: NextRequest) {
    const csrfFailure = enforceCsrf(req);
    if (csrfFailure) return csrfFailure;

    const oldToken = req.cookies.get("jwt")?.value;
    if (!oldToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    try {
        const decoded: any = verifyJwt(oldToken, JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER);
        const userShape = {
            id: decoded.discordId,
            username: decoded.username,
            global_name: decoded.global_name,
            avatar: decoded.avatar,
            discriminator: decoded.discriminator
        };
        const newToken = issueJwt(userShape, JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER);
        const res = NextResponse.json({ refreshed: true });
        res.cookies.set("jwt", newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 20 * 60, // 20 minutes
        });
        // Optionally rotate CSRF token with refresh
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        return res;
    } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
}
