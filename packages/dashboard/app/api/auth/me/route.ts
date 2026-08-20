import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@zeffuro/fakegaming-common";
import { getJwtConfig } from "@/lib/env";
import { ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth/sessionConstants";
import { getRequestDashboardMessageFromRequest } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
    const jwtToken = req.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    if (!jwtToken) return NextResponse.json({ error: getRequestDashboardMessageFromRequest(req, "error.notAuthenticated") }, { status: 401 });

    try {
        const { secret, audience, issuer } = getJwtConfig();
        const user = verifyJwt(jwtToken, secret, audience, issuer);
        return NextResponse.json({ user });
    } catch {
        return NextResponse.json({ error: getRequestDashboardMessageFromRequest(req, "error.invalidSession") }, { status: 401 });
    }
}

export async function PUT(req: NextRequest) {
    return GET(req);
}
