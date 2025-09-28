import jwt from "jsonwebtoken";
import {DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, JWT_SECRET} from "@/lib/env";

export function getDiscordOAuthUrl() {
    return `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
}

export async function exchangeCodeForToken(code: string) {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: DISCORD_REDIRECT_URI,
        }),
    });
    return await tokenRes.json();
}

export async function fetchDiscordUser(accessToken: string) {
    const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: {Authorization: `Bearer ${accessToken}`},
    });
    return await userRes.json();
}

export function issueJwt(user: any) {
    return jwt.sign({
        id: user.id,
        username: user.username,
        avatar: user.avatar
    }, JWT_SECRET, {expiresIn: "7d"});
}

export function verifyJwt(token: string) {
    return jwt.verify(token, JWT_SECRET);
}
