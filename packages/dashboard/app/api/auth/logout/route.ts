import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/util/getBaseUrl";

export async function GET(req: NextRequest) {
    const response = NextResponse.redirect(`${getBaseUrl(req)}/`);

    response.cookies.set({
        name: "jwt",
        value: "",
        path: "/",
        expires: new Date(0),
        sameSite: "lax",
    });

    return response;
}
