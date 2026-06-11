import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@zeffuro/fakegaming-common";
import { JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER } from "@/lib/env";
import { ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth/sessionConstants";

export async function GET(req: NextRequest) {
    const jwtToken = req.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    if (!jwtToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    try {
        const user = verifyJwt(jwtToken, JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER);
        return NextResponse.json({ user });
    } catch (err) {
        return NextResponse.json({ error: "Invalid token", details: String(err) }, { status: 401 });
    }
}

export async function PUT(req: NextRequest) {
    return GET(req);
}
