import {NextRequest, NextResponse} from "next/server";

export async function GET(req: NextRequest) {
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set("jwt", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    return response;
}

