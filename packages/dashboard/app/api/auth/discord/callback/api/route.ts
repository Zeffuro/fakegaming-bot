import {NextRequest, NextResponse} from "next/server";
import {exchangeCodeForToken, fetchDiscordUser, fetchDiscordGuilds, issueJwt} from '@zeffuro/fakegaming-common/src/discord/auth';
import {DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, JWT_SECRET} from '@/lib/env';

export async function POST(req: NextRequest) {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    // Exchange code for access_token
    const tokenData = await exchangeCodeForToken(code, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI);
    if (!tokenData.access_token) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

    // Fetch user info
    const user = await fetchDiscordUser(tokenData.access_token);
    // Fetch user guilds
    const guilds = await fetchDiscordGuilds(tokenData.access_token);

    // Issue JWT
    const jwtToken = issueJwt(user, guilds, JWT_SECRET);

    // Return JWT in response body
    return NextResponse.json({ token: jwtToken, user });
}

