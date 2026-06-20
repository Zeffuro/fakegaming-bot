/**
 * Common helper for API authentication and guild permission checks
 */
import { Request, Response, NextFunction } from 'express';
import { defaultCacheManager, CACHE_KEYS, MinimalGuildData, getLogger, isGuildAdmin } from '@zeffuro/fakegaming-common';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import { isDashboardAdmin } from './dashboardAdmin.js';

// Prefer the shared in-memory cache used by tests, fallback to default
const _cache = ((globalThis as any).__testCacheManager ?? defaultCacheManager) as typeof defaultCacheManager;
const log = getLogger({ name: 'api:authHelpers' });

interface RequestWithOptionalUser extends Request {
    user?: {
        discordId?: string;
    };
}

function getDiscordId(req: Request): string | undefined {
    return (req as RequestWithOptionalUser).user?.discordId;
}

/**
 * Helper to check if a user has admin permissions for a guild
 */
export async function checkUserGuildAccess(
    req: Request,
    res: Response,
    guildId: string | undefined
): Promise<{ authorized: boolean, guilds?: MinimalGuildData[] }> {
    const discordId = getDiscordId(req);

    if (!guildId) {
        res.status(400).json({ error: 'Missing guild ID parameter' });
        return { authorized: false };
    }

    if (isServiceRequest(req) || isDashboardAdmin(discordId)) {
        return { authorized: true };
    }

    if (!discordId) {
        res.status(401).json({ error: 'Authentication required' });
        return { authorized: false };
    }

    // Read from the test-aware cache to ensure consistency in tests
    const guilds = await _cache.get<MinimalGuildData[]>(CACHE_KEYS.userGuilds(discordId));
    if (!guilds) {
        log.warn({ discordId }, 'Cache miss for user guilds');
        res.status(403).json({ error: 'Not authorized for this guild' });
        return { authorized: false };
    }

    if (!isGuildAdmin(guilds, guildId)) {
        res.status(403).json({ error: 'Not authorized for this guild' });
        return { authorized: false };
    }

    return { authorized: true, guilds };
}

export interface GuildScopedRecord {
    guildId?: string | null;
}

export async function filterGuildScopedRecordsForRequest<T extends GuildScopedRecord>(
    req: Request,
    res: Response,
    records: T[],
    guildId: string | undefined
): Promise<T[] | null> {
    const discordId = getDiscordId(req);

    if (isServiceRequest(req) || isDashboardAdmin(discordId)) {
        return guildId ? records.filter(record => record.guildId === guildId) : records;
    }

    if (!discordId) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }

    if (guildId) {
        const access = await checkUserGuildAccess(req, res, guildId);
        if (!access.authorized) return null;
        return records.filter(record => record.guildId === guildId);
    }

    const guilds = await _cache.get<MinimalGuildData[]>(CACHE_KEYS.userGuilds(discordId));
    if (!guilds) {
        log.warn({ discordId }, 'Cache miss for user guilds');
        res.status(403).json({ error: 'Not authorized for this guild' });
        return null;
    }

    const authorizedGuildIds = new Set(
        guilds
            .filter(guild => isGuildAdmin(guilds, guild.id))
            .map(guild => guild.id)
    );

    return records.filter(record => typeof record.guildId === 'string' && authorizedGuildIds.has(record.guildId));
}

export async function checkGuildScopedRecordAccess<T extends GuildScopedRecord>(
    req: Request,
    res: Response,
    record: T
): Promise<boolean> {
    const guildId = typeof record.guildId === 'string' ? record.guildId : undefined;
    const visibleRecords = await filterGuildScopedRecordsForRequest(req, res, [record], guildId);
    if (!visibleRecords) return false;
    if (visibleRecords.length === 0) {
        res.status(403).json({ error: 'Not authorized for this guild' });
        return false;
    }
    return true;
}

export async function checkGuildScopedUpdateAccess<T extends GuildScopedRecord>(
    req: Request,
    res: Response,
    record: T,
    nextGuildId: string | undefined
): Promise<boolean> {
    const hasCurrentAccess = await checkGuildScopedRecordAccess(req, res, record);
    if (!hasCurrentAccess) return false;

    if (nextGuildId && nextGuildId !== record.guildId) {
        const nextAccess = await checkUserGuildAccess(req, res, nextGuildId);
        return nextAccess.authorized;
    }

    return true;
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
            log.error({ err }, 'Error checking guild access');
            res.status(500).json({ error: 'Internal server error during authorization check' });
        });
}
