export const PUBLIC_URL = (process.env.NEXT_PUBLIC_PUBLIC_URL || process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
export const DISCORD_REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI || `${PUBLIC_URL}/api/auth/discord/callback`;

function requireEnv(name: string): string {
    const val = process.env[name];
    if (!val || val.trim() === "") {
        throw new Error(`[env] Missing required environment variable: ${name}`);
    }
    return val;
}

// Security-critical: must be set explicitly
export const JWT_SECRET = requireEnv("JWT_SECRET");
export const JWT_AUDIENCE = requireEnv("JWT_AUDIENCE");
export const JWT_ISSUER = requireEnv("JWT_ISSUER");

export const API_URL = (process.env.API_URL || "http://localhost:3001");
