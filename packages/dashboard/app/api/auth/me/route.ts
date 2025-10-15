import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@zeffuro/fakegaming-common";
import { JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER } from "@/lib/env";
import { enforceCsrf } from "@/lib/security/csrf.js";

export async function PUT(req: NextRequest) {
    const csrfFailure = enforceCsrf(req);
    if (csrfFailure) return csrfFailure;

    const jwtToken = req.cookies.get("jwt")?.value;
    if (!jwtToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    try {
        const user = verifyJwt(jwtToken, JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER);
        return NextResponse.json({ user });
    } catch (err) {
        return NextResponse.json({ error: "Invalid token", details: String(err) }, { status: 401 });
    }
}