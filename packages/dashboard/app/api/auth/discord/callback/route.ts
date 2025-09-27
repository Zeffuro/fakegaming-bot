import {NextRequest, NextResponse} from "next/server";
import {exchangeCodeForToken, fetchDiscordUser, issueJwt} from "../../../../utils/discordOAuth";

export async function GET(req: NextRequest) {
    const {searchParams} = new URL(req.url);
    const code = searchParams.get("code");
    if (!code) return NextResponse.json({error: "Missing code"}, {status: 400});

    // Exchange code for access_token
    const tokenData = await exchangeCodeForToken(code);
    if (!tokenData.access_token) return NextResponse.json({error: "Invalid code"}, {status: 400});

    // Fetch user info
    const user = await fetchDiscordUser(tokenData.access_token);

    // Issue JWT
    const jwtToken = issueJwt(user);

    // Set JWT in HttpOnly cookie and redirect to dashboard
    const dashboardUrl = new URL("/dashboard", req.url);
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.set("jwt", jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
    });
    return response;
}
