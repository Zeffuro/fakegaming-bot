import {NextRequest, NextResponse} from "next/server";
import {getBaseUrl} from "@/lib/util/getBaseUrl";

export async function GET(req: NextRequest) {
    const response = NextResponse.redirect(new URL("/", getBaseUrl(req)));
    response.cookies.set("jwt", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    return response;
}