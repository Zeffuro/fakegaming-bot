import {NextRequest, NextResponse} from "next/server";
import jwt from "jsonwebtoken";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/api/auth/discord/callback";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// /api/auth/discord: Redirect to Discord OAuth
export async function GET() {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    return NextResponse.redirect(url);
}

// /api/auth/discord/callback: Exchange code for token, fetch user, issue JWT
export async function POST(req: NextRequest) {
    const {code} = await req.json();
    if (!code) return NextResponse.json({error: "Missing code"}, {status: 400});

    // Exchange code for access_token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID!,
            client_secret: DISCORD_CLIENT_SECRET!,
            grant_type: "authorization_code",
            code,
            redirect_uri: DISCORD_REDIRECT_URI,
        }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return NextResponse.json({error: "Invalid code"}, {status: 400});

    // Fetch user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: {Authorization: `Bearer ${tokenData.access_token}`},
    });
    const user = await userRes.json();

    // Issue JWT
    const jwtToken = jwt.sign({
        id: user.id,
        username: user.username,
        avatar: user.avatar
    }, JWT_SECRET, {expiresIn: "7d"});
    return NextResponse.json({token: jwtToken, user});
}

// /api/auth/me: Get user info from JWT
export async function PUT(req: NextRequest) {
    const {token} = await req.json();
    try {
        const user = jwt.verify(token, JWT_SECRET);
        return NextResponse.json({user});
    } catch {
        return NextResponse.json({error: "Invalid token"}, {status: 401});
    }
}
