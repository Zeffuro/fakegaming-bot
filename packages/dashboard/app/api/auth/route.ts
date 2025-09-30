import {NextRequest, NextResponse} from "next/server";
import {
    getDiscordOAuthUrl,
    exchangeCodeForToken,
    fetchDiscordUser,
    fetchDiscordGuilds,
    issueJwt,
    verifyJwt
} from "@/lib/discord/auth";
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, JWT_SECRET, JWT_AUDIENCE } from '@/lib/env';

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
    const tokenData = await exchangeCodeForToken(code, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI);
    if (!tokenData.access_token) return NextResponse.json({error: "Invalid code"}, {status: 400});

    // Fetch user info
    const user = await fetchDiscordUser(tokenData.access_token);
    // TODO: Fetch user guilds and put them into the cache?
    const guilds = await fetchDiscordGuilds(tokenData.access_token);

    // Issue JWT with all required arguments
    const jwtToken = issueJwt(user, JWT_SECRET, JWT_AUDIENCE);
    return NextResponse.json({token: jwtToken, user, guilds});
}

// /api/auth/me: Get user info from JWT
export async function PUT(req: NextRequest) {
    const {token} = await req.json();
    try {
        const user = verifyJwt(token, JWT_SECRET, JWT_AUDIENCE);
        return NextResponse.json({user});
    } catch {
        return NextResponse.json({error: "Invalid token"}, {status: 401});
    }
}
