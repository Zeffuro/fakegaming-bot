import {NextRequest, NextResponse} from "next/server";

const DASHBOARD_URL = process.env.PUBLIC_URL || "http://localhost:3000";

export async function OPTIONS() {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", DASHBOARD_URL);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return response;
}

export async function POST(req: NextRequest) {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
    const response = NextResponse.json({ success: true });
    response.cookies.set("jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
    });
    response.headers.set("Access-Control-Allow-Origin", DASHBOARD_URL);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    return response;
}
