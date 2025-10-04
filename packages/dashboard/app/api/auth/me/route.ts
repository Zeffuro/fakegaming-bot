import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/common/discord";
import { JWT_SECRET, JWT_AUDIENCE } from "@/lib/env";

export async function PUT(req: NextRequest) {
    const jwtToken = req.cookies.get("jwt")?.value;
    if (!jwtToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    try {
        const user = verifyJwt(jwtToken, JWT_SECRET, JWT_AUDIENCE);
        return NextResponse.json({ user });
    } catch (err) {
        return NextResponse.json({ error: "Invalid token", details: String(err) }, { status: 401 });
    }
}