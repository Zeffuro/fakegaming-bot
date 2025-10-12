import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import type { MinimalGuildData } from "@zeffuro/fakegaming-common";
import { isGuildAdmin as commonIsGuildAdmin, defaultCacheManager, CACHE_KEYS } from "@zeffuro/fakegaming-common";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const DASHBOARD_ADMINS = (process.env.DASHBOARD_ADMINS || "").split(",").map(id => id.trim()).filter(Boolean);

export interface AuthenticatedUser {
    discordId: string;
}

export interface AuthResult {
    success: boolean;
    user?: AuthenticatedUser;
    error?: string;
    statusCode?: number;
}

export interface GuildAccessResult {
    hasAccess: boolean;
    isAdmin: boolean;
    error?: string;
    statusCode?: number;
}

/**
 * Authenticate user from JWT cookie
 */
export async function authenticateUser(req: NextRequest): Promise<AuthResult> {
    const jwtToken = req.cookies.get("jwt")?.value;
    if (!jwtToken) {
        return { success: false, error: "Not authenticated", statusCode: 401 };
    }

    try {
        const user = jwt.verify(jwtToken, JWT_SECRET) as { discordId: string };
        return { success: true, user: { discordId: user.discordId } };
    } catch {
        return { success: false, error: "Invalid token", statusCode: 401 };
    }
}

/**
 * Check if user is a dashboard admin
 */
export function isDashboardAdmin(discordId: string): boolean {
    return DASHBOARD_ADMINS.includes(discordId);
}

/**
 * Check if user has access to a specific guild
 */
export async function checkGuildAccess(user: AuthenticatedUser, guildId: string): Promise<GuildAccessResult> {
    if (isDashboardAdmin(user.discordId)) {
        return { hasAccess: true, isAdmin: true };
    }

    const guilds = await defaultCacheManager.get<MinimalGuildData[]>(CACHE_KEYS.userGuilds(user.discordId));

    if (!guilds) {
        return {
            hasAccess: false,
            isAdmin: false,
            error: "Redis unavailable or guilds not cached for user",
            statusCode: 503
        };
    }

    const hasAccess = commonIsGuildAdmin(guilds, guildId);
    return { hasAccess, isAdmin: false };
}
