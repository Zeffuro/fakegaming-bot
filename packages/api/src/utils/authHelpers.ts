/**
 * Common helper for API authentication and guild permission checks
 */
import { Request, Response, NextFunction } from 'express';
import {
    CACHE_KEYS,
    CACHE_TTL,
    defaultCacheManager,
    getDiscordGuilds,
    getLogger,
    isGuildAdmin,
    type MinimalGuildData,
} from '@zeffuro/fakegaming-common';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import { isDashboardAdmin } from './dashboardAdmin.js';

// Prefer the shared in-memory cache used by tests, fallback to default
const _cache = ((globalThis as any).__testCacheManager ?? defaultCacheManager) as typeof defaultCacheManager;
const log = getLogger({ name: 'api:authHelpers' });
const DEFAULT_GUILD_ACCESS_REFRESH_TIMEOUT_MS = 2500;

interface DiscordGuildPayload {
    id?: unknown;
    owner?: unknown;
    permissions?: unknown;
}

interface UserGuildsLoadResult {
    guilds: MinimalGuildData[] | null;
    message?: string;
    statusCode?: number;
}

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

    const loadResult = await loadUserGuildsForAccess(req, discordId);
    if (!loadResult.guilds) {
        sendGuildAccessUnavailable(res, loadResult);
        return { authorized: false };
    }

    if (!isGuildAdmin(loadResult.guilds, guildId)) {
        res.status(403).json({ error: 'Not authorized for this guild' });
        return { authorized: false };
    }

    return { authorized: true, guilds: loadResult.guilds };
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

    const loadResult = await loadUserGuildsForAccess(req, discordId);
    if (!loadResult.guilds) {
        sendGuildAccessUnavailable(res, loadResult);
        return null;
    }

    const authorizedGuildIds = new Set(
        loadResult.guilds
            .filter(guild => isGuildAdmin(loadResult.guilds ?? [], guild.id))
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

async function loadUserGuildsForAccess(req: Request, discordId: string): Promise<UserGuildsLoadResult> {
    const cacheKey = CACHE_KEYS.userGuilds(discordId);
    try {
        const cachedGuilds = await _cache.get<MinimalGuildData[]>(cacheKey);
        if (Array.isArray(cachedGuilds)) {
            return { guilds: cachedGuilds };
        }
        log.warn({ discordId }, 'Cache miss for user guilds; attempting Discord refresh');
    } catch (err) {
        log.warn({ err, discordId }, 'Failed to read cached Discord guilds; attempting Discord refresh');
    }

    return refreshUserGuildsForAccess(req, discordId);
}

async function refreshUserGuildsForAccess(_req: Request, discordId: string): Promise<UserGuildsLoadResult> {
    let accessToken: string | null = null;
    try {
        accessToken = await _cache.get<string>(CACHE_KEYS.userAccessToken(discordId));
    } catch (err) {
        log.warn({ err, discordId }, 'Failed to read cached Discord access token');
        return {
            guilds: null,
            message: 'Guild access could not be verified because the access cache is unavailable. Refresh the dashboard session and try again.',
            statusCode: 503,
        };
    }

    if (!accessToken) {
        return {
            guilds: null,
            message: 'Guild access could not be verified because cached Discord guilds expired. Refresh the dashboard session and try again.',
            statusCode: 503,
        };
    }

    try {
        const timeoutMs = readPositiveIntegerEnv('API_GUILD_ACCESS_REFRESH_TIMEOUT_MS', DEFAULT_GUILD_ACCESS_REFRESH_TIMEOUT_MS);
        const rawGuilds = await withTimeout(
            getDiscordGuilds(accessToken, 'Bearer') as Promise<unknown>,
            timeoutMs,
            `Discord guild refresh timed out after ${timeoutMs}ms`
        );
        const guilds = toMinimalGuilds(rawGuilds);
        await cacheUserGuilds(discordId, guilds);
        return { guilds };
    } catch (err) {
        log.warn({ err, discordId }, 'Failed to refresh Discord guild access');
        return {
            guilds: null,
            message: 'Guild access could not be refreshed from Discord. Refresh the dashboard session and try again.',
            statusCode: 503,
        };
    }
}

async function cacheUserGuilds(discordId: string, guilds: MinimalGuildData[]): Promise<void> {
    try {
        await _cache.set(CACHE_KEYS.userGuilds(discordId), guilds, CACHE_TTL.USER_GUILDS);
    } catch (err) {
        log.warn({ err, discordId }, 'Failed to cache refreshed Discord guilds');
    }
}

function sendGuildAccessUnavailable(res: Response, result: UserGuildsLoadResult): void {
    res.status(result.statusCode ?? 503).json({
        error: {
            code: 'GUILD_ACCESS_UNAVAILABLE',
            message: result.message ?? 'Guild access could not be verified. Refresh the dashboard session and try again.',
            recovery: 'Refresh the dashboard session, then retry the request.',
        },
    });
}

function toMinimalGuilds(value: unknown): MinimalGuildData[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((guild: DiscordGuildPayload): MinimalGuildData | null => {
            if (typeof guild.id !== 'string' || guild.id.length === 0) return null;
            return {
                id: guild.id,
                ...(guild.permissions !== undefined && guild.permissions !== null ? { permissions: String(guild.permissions) } : {}),
                ...(typeof guild.owner === 'boolean' ? { owner: guild.owner } : {}),
            };
        })
        .filter((guild): guild is MinimalGuildData => guild !== null);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        timer.unref?.();
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
