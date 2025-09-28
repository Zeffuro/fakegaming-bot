import {NextRequest, NextResponse} from "next/server";
import {
    getDiscordOAuthUrl,
    exchangeCodeForToken,
    fetchDiscordUser,
    issueJwt,
    verifyJwt
} from "@/lib/discord/auth";

// /api/auth/discord: Redirect to Discord OAuth
export async function GET() {
    const url = getDiscordOAuthUrl();
    return NextResponse.redirect(url);
}

// /api/auth/discord/callback: Exchange code for token, fetch user, issue JWT
export async function POST(req: NextRequest) {
    const {code} = await req.json();
    if (!code) return NextResponse.json({error: "Missing code"}, {status: 400});

    // Exchange code for access_token
    const tokenData = await exchangeCodeForToken(code);
    if (!tokenData.access_token) return NextResponse.json({error: "Invalid code"}, {status: 400});

    // Fetch user info
    const user = await fetchDiscordUser(tokenData.access_token);

    // Issue JWT
    const jwtToken = issueJwt(user);
    return NextResponse.json({token: jwtToken, user});
}

// /api/auth/me: Get user info from JWT
export async function PUT(req: NextRequest) {
    const {token} = await req.json();
    try {
        const user = verifyJwt(token);
        return NextResponse.json({user});
    } catch {
        return NextResponse.json({error: "Invalid token"}, {status: 401});
    }
}
