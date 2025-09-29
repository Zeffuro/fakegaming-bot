import jwt from "jsonwebtoken";
import {DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, JWT_SECRET} from "@/lib/env";
import { setCache } from "@/lib/cache";

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
    for (let attempt = 0; attempt < 3; attempt++) {
        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: {Authorization: `Bearer ${accessToken}`},
        });
        if (userRes.status === 429) {
            const errorBody = await userRes.json();
            const retryAfter = errorBody.retry_after ? Number(errorBody.retry_after) * 1000 : 1000;
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
        }
        if (!userRes.ok) {
            throw new Error(await userRes.text());
        }
        return await userRes.json();
    }
    throw new Error("Discord rate limit exceeded for /users/@me");
}

export async function fetchDiscordGuilds(accessToken: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (guildsRes.status === 429) {
            const errorBody = await guildsRes.json();
            const retryAfter = errorBody.retry_after ? Number(errorBody.retry_after) * 1000 : 1000;
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
        }
        if (!guildsRes.ok) {
            throw new Error(await guildsRes.text());
        }
        return await guildsRes.json();
    }
    throw new Error("Discord rate limit exceeded for /users/@me/guilds");
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

export async function handleDiscordLogin(code: string) {
    const tokenData = await exchangeCodeForToken(code);
    const accessToken = tokenData.access_token;
    const user = await fetchDiscordUser(accessToken);
    const guilds = await fetchDiscordGuilds(accessToken); // Fetch fresh guilds
    await setCache(`user_guilds:${user.id}`, guilds, 10 * 60 * 1000); // Cache for 10 minutes
    const jwtToken = issueJwt(user);
    return { jwtToken, user, accessToken, guilds };
}
