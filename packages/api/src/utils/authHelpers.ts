/**
 * Common helper for API authentication and guild permission checks
 */
import { Request, Response, NextFunction } from 'express';
import { defaultCacheManager, CACHE_KEYS, MinimalGuildData } from '@zeffuro/fakegaming-common';
import { isGuildAdmin } from '@zeffuro/fakegaming-common';
import type { AuthenticatedRequest } from '../types/express.js';

/**
 * Helper to check if a user has admin permissions for a guild
 * This handles the common pattern of fetching guild data from cache and checking permissions
 */
export async function checkUserGuildAccess(
    req: Request,
    res: Response,
    guildId: string | undefined
): Promise<{ authorized: boolean, guilds?: MinimalGuildData[] }> {
    const { discordId } = (req as AuthenticatedRequest).user;

    if (!guildId) {
        res.status(400).json({ error: 'Missing guild ID parameter' });
        return { authorized: false };
    }

    // Get user guilds from cache
    const guilds = await defaultCacheManager.get<MinimalGuildData[]>(CACHE_KEYS.userGuilds(discordId));
    if (!guilds) {
        console.error(`[API] Cache miss for user guilds ${discordId}`);
        res.status(503).json({
            error: 'Redis unavailable or guilds not cached for user',
            detail: 'Please try refreshing your dashboard to re-fetch guild data'
        });
        return { authorized: false };
    }

    // Check if user has admin permissions for this guild
    if (!isGuildAdmin(guilds, guildId)) {
        res.status(403).json({ error: 'Not authorized for this guild' });
        return { authorized: false };
    }

    // User is authorized
    return { authorized: true, guilds };
}

/**
 * Middleware that requires admin permission for a guild specified in the request
 * The guild ID is expected in req.params.guildId or req.query.guildId or req.body.guildId
 */
export function requireGuildAdmin(req: Request, res: Response, next: NextFunction): void {
    const guildId = req.params.guildId || req.query.guildId as string || req.body.guildId;

    checkUserGuildAccess(req, res, guildId)
        .then(result => {
            if (result.authorized) {
                next();
            }
            // If not authorized, response is already sent by the checkUserGuildAccess function
        })
        .catch(err => {
            console.error('[Auth] Error checking guild access:', err);
            res.status(500).json({ error: 'Internal server error during authorization check' });
        });
}
