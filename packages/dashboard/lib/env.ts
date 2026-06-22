export const PUBLIC_URL = (process.env.NEXT_PUBLIC_PUBLIC_URL || process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");

export interface DiscordOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface DiscordOAuthAuthorizeConfig {
    clientId: string;
    redirectUri: string;
}

export interface JwtConfig {
    secret: string;
    audience: string;
    issuer: string;
}

export function requireEnv(name: string): string {
    const val = process.env[name];
    if (!val || val.trim() === "") {
        throw new Error(`[env] Missing required environment variable: ${name}`);
    }
    return val;
}

export const DISCORD_REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI || `${PUBLIC_URL}/api/auth/discord/callback`;

export function getDiscordOAuthAuthorizeConfig(): DiscordOAuthAuthorizeConfig {
    return {
        clientId: requireEnv("DISCORD_CLIENT_ID"),
        redirectUri: DISCORD_REDIRECT_URI
    };
}

export function getDiscordOAuthConfig(): DiscordOAuthConfig {
    return {
        ...getDiscordOAuthAuthorizeConfig(),
        clientSecret: requireEnv("DISCORD_CLIENT_SECRET")
    };
}

export function getJwtConfig(): JwtConfig {
    return {
        secret: requireEnv("JWT_SECRET"),
        audience: requireEnv("JWT_AUDIENCE"),
        issuer: requireEnv("JWT_ISSUER")
    };
}

export const API_URL = (process.env.API_URL || "http://localhost:3001/api");
export const SERVICE_API_TOKEN = process.env.SERVICE_API_TOKEN || process.env.INTERNAL_API_TOKEN || process.env.API_SERVICE_TOKEN || "";
