import jwt from "jsonwebtoken";

const DEFAULT_AUDIENCE = process.env.JWT_AUDIENCE || "fakegaming-dashboard";
const DEFAULT_ISSUER = process.env.JWT_ISSUER || "fakegaming";

/**
 * Small sleep helper for retry waits
 */
async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON with retry on Discord 429 responses.
 */
export async function retryFetchJson<T>(params: {
    url: string;
    init?: RequestInit;
    maxAttempts?: number;
    rateLimitExhaustedMessage: string;
}): Promise<T> {
    const { url, init, maxAttempts = 3, rateLimitExhaustedMessage } = params;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res = await fetch(url, init);
        if (res.status === 429) {
            const errorBody = (await res.json().catch(() => ({}))) as { retry_after?: number } | Record<string, unknown>;
            const retryAfterSeconds = typeof (errorBody as any).retry_after === 'number' ? Number((errorBody as any).retry_after) : undefined;
            const waitMs = retryAfterSeconds !== undefined ? retryAfterSeconds * 1000 : 1000;
            await sleep(waitMs);
            continue;
        }
        if (!res.ok) {
            throw new Error(await res.text());
        }
        return (await res.json()) as T;
    }
    throw new Error(rateLimitExhaustedMessage);
}

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
    return retryFetchJson<any>({
        url: "https://discord.com/api/users/@me",
        init: {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
        rateLimitExhaustedMessage: "Discord rate limit exceeded for /users/@me",
    });
}

export async function getDiscordGuilds(accessToken: string, tokenType: "Bearer" | "Bot" = "Bearer") {
    return retryFetchJson<any>({
        url: "https://discord.com/api/users/@me/guilds",
        init: {
            headers: { Authorization: `${tokenType} ${accessToken}` },
        },
        rateLimitExhaustedMessage: "Discord rate limit exceeded for /users/@me/guilds",
    });
}

export function getDiscordOAuthUrl(discordClientId: string, discordRedirectUri: string) {
    return `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${encodeURIComponent(discordRedirectUri)}&response_type=code&scope=identify%20guilds`;
}

export function issueJwt(user: any, jwtSecret: string, audience: string = DEFAULT_AUDIENCE, issuer: string = DEFAULT_ISSUER) {
    return jwt.sign({
        discordId: user.id,
        username: user.username,
        global_name: user.global_name || null,
        avatar: user.avatar || null,
        discriminator: user.discriminator || null
    }, jwtSecret, {
        expiresIn: "1d",
        audience,
        issuer
    });
}

export function verifyJwt(token: string, jwtSecret: string, audience: string = DEFAULT_AUDIENCE, issuer: string = DEFAULT_ISSUER) {
    return jwt.verify(token, jwtSecret, { audience, issuer });
}

export async function getDiscordGuildChannels(guildId: string, botToken: string) {
    const channels = await retryFetchJson<any[]>({
        url: `https://discord.com/api/guilds/${guildId}/channels`,
        init: {
            headers: { Authorization: `Bot ${botToken}` },
        },
        rateLimitExhaustedMessage: "Discord rate limit exceeded for guild channels",
    });
    return channels.filter((channel: any) => channel.type === 0 || channel.type === 5);
}

export async function getDiscordUserById(userId: string, botToken: string) {
    return retryFetchJson<any>({
        url: `https://discord.com/api/users/${userId}`,
        init: {
            headers: { Authorization: `Bot ${botToken}` },
        },
        rateLimitExhaustedMessage: "Discord rate limit exceeded for /users/{id}",
    });
}

export async function getDiscordGuildMember(guildId: string, userId: string, botToken: string) {
    return retryFetchJson<any>({
        url: `https://discord.com/api/guilds/${guildId}/members/${userId}`,
        init: {
            headers: { Authorization: `Bot ${botToken}` },
        },
        rateLimitExhaustedMessage: "Discord rate limit exceeded for guild member",
    });
}

/**
 * Search guild members by query (requires GUILD_MEMBERS intent)
 */
export async function getDiscordGuildMembersSearch(params: { guildId: string; query: string; botToken: string; limit?: number; }): Promise<any[]> {
    const { guildId, query, botToken, limit = 25 } = params;
    const q = encodeURIComponent(query);
    const url = `https://discord.com/api/guilds/${guildId}/members/search?query=${q}&limit=${limit}`;
    return retryFetchJson<any[]>({
        url,
        init: {
            headers: { Authorization: `Bot ${botToken}` },
        },
        rateLimitExhaustedMessage: "Discord rate limit exceeded for guild member search",
    });
}
