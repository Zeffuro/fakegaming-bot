import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@zeffuro/fakegaming-common";
import { getJwtConfig } from "@/lib/env";
import { ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth/sessionConstants";

export async function GET(req: NextRequest) {
    const jwtToken = req.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    if (!jwtToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    try {
        const { secret, audience, issuer } = getJwtConfig();
        const user = verifyJwt(jwtToken, secret, audience, issuer);
        return NextResponse.json({ user });
    } catch (err) {
        return NextResponse.json({ error: "Invalid token", details: String(err) }, { status: 401 });
    }
}

export async function PUT(req: NextRequest) {
    return GET(req);
}
