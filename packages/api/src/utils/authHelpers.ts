/**
 * Common helper for API authentication and guild permission checks
 */
import { Request, Response, NextFunction } from 'express';
import { defaultCacheManager, CACHE_KEYS, MinimalGuildData } from '@zeffuro/fakegaming-common';
import { isGuildAdmin } from '@zeffuro/fakegaming-common';
import type { AuthenticatedRequest } from '../types/express.js';

// Prefer the shared in-memory cache used by tests, fallback to default
const _cache = ((globalThis as any).__testCacheManager ?? defaultCacheManager) as typeof defaultCacheManager;

/**
 * Helper to check if a user has admin permissions for a guild
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

    // Read from the test-aware cache to ensure consistency in tests
    const guilds = await _cache.get<MinimalGuildData[]>(CACHE_KEYS.userGuilds(discordId));
    if (!guilds) {
        console.error(`[API] Cache miss for user guilds ${discordId}`);
        res.status(403).json({ error: 'Not authorized for this guild' });
        return { authorized: false };
    }

    if (!isGuildAdmin(guilds, guildId)) {
        res.status(403).json({ error: 'Not authorized for this guild' });
        return { authorized: false };
    }

    return { authorized: true, guilds };
}

/**
 * Middleware that requires admin permission for a guild specified in the request
 */
export function requireGuildAdmin(req: Request, res: Response, next: NextFunction): void {
    const guildId = req.params.guildId || req.query.guildId as string || req.body.guildId;

    checkUserGuildAccess(req, res, guildId)
        .then(result => {
            if (result.authorized) {
                next();
            }
        })
        .catch(err => {
            console.error('[Auth] Error checking guild access:', err);
            res.status(500).json({ error: 'Internal server error during authorization check' });
        });
}
