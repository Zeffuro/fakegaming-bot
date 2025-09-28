export const PUBLIC_URL = (process.env.NEXT_PUBLIC_PUBLIC_URL || process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
export const DISCORD_REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI || `${PUBLIC_URL}/api/auth/discord/callback`;
export const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
