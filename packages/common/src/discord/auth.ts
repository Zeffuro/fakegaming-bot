import jwt from "jsonwebtoken";

const DEFAULT_AUDIENCE = process.env.JWT_AUDIENCE || "fakegaming-dashboard";

export async function exchangeCodeForToken(code: string, clientId: string, clientSecret: string, redirectUri: string) {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
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

export function issueJwt(user: any, jwtSecret: string, audience: string = DEFAULT_AUDIENCE) {
    return jwt.sign({
        discordId: user.id,
        username: user.username
    }, jwtSecret, {
        expiresIn: "7d",
        audience
    });
}

export function verifyJwt(token: string, jwtSecret: string, audience: string = DEFAULT_AUDIENCE) {
    return jwt.verify(token, jwtSecret, { audience });
}
