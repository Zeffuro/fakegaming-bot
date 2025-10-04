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

export async function getDiscordGuilds(accessToken: string, tokenType: "Bearer" | "Bot" = "Bearer") {
    for (let attempt = 0; attempt < 3; attempt++) {
        const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
            headers: { Authorization: `${tokenType} ${accessToken}` },
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

export function getDiscordOAuthUrl(discordClientId: string, discordRedirectUri: string) {
    return `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${encodeURIComponent(discordRedirectUri)}&response_type=code&scope=identify%20guilds`;
}

export function issueJwt(user: any, jwtSecret: string, audience: string = DEFAULT_AUDIENCE) {
    return jwt.sign({
        discordId: user.id,
        username: user.username,
        global_name: user.global_name || null,
        avatar: user.avatar || null,
        discriminator: user.discriminator || null
    }, jwtSecret, {
        expiresIn: "7d",
        audience
    });
}

export function verifyJwt(token: string, jwtSecret: string, audience: string = DEFAULT_AUDIENCE) {
    return jwt.verify(token, jwtSecret, { audience });
}

export async function getDiscordGuildChannels(guildId: string, botToken: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const channelsRes = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${botToken}` },
        });
        if (channelsRes.status === 429) {
            const errorBody = await channelsRes.json();
            const retryAfter = errorBody.retry_after ? Number(errorBody.retry_after) * 1000 : 1000;
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
        }
        if (!channelsRes.ok) {
            throw new Error(await channelsRes.text());
        }
        const channels = await channelsRes.json();
        // Filter to only text channels (type 0) and announcement channels (type 5)
        return channels.filter((channel: any) => channel.type === 0 || channel.type === 5);
    }
    throw new Error("Discord rate limit exceeded for guild channels");
}
