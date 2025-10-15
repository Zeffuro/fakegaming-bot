import type { Request, Response, NextFunction } from 'express';
import { PostgresRateLimiter, getSequelize, getLogger, incMetric } from '@zeffuro/fakegaming-common';

// Build-time flag to skip DB initialization (e.g., during OpenAPI export)
const SKIP = process.env.API_BUILD_MODE === 'openapi' || process.env.SKIP_DB_INIT === '1';

// Lazily-initialized limiter instance for runtime use
let _limiter: PostgresRateLimiter | undefined;
const log = getLogger({ name: 'api:rate-limit' });

function ensureLimiter(): PostgresRateLimiter {
    if (!_limiter) {
        const useTest = process.env.NODE_ENV === 'test';
        _limiter = new PostgresRateLimiter(getSequelize(useTest));
    }
    return _limiter;
}

// Export a non-undefined lazy wrapper to keep tests/types happy
const lazyLimiter: PostgresRateLimiter = new Proxy({} as unknown as PostgresRateLimiter, {
    get(_target, prop, _receiver) {
        const inst: any = ensureLimiter() as any;
        const value = inst[prop as keyof typeof inst];
        if (typeof value === 'function') {
            return value.bind(inst);
        }
        return value;
    }
});

/**
 * Exposed for tests or advanced usage; lazily resolves to the real limiter on first access.
 */
export const limiter: PostgresRateLimiter = lazyLimiter;

let cleanupTimer: NodeJS.Timeout | undefined;

/**
 * Schedule periodic cleanup of expired rate limit buckets.
 * Retention defaults to 10 * window length (or explicit RATE_LIMIT_RETENTION_MS).
 */
export function scheduleRateLimitCleanup() {
    if (SKIP) return; // skip when building docs or explicitly disabled
    if (process.env.NODE_ENV === 'test') return; // skip in tests
    if (cleanupTimer) return;
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
    const retentionMs = Number(process.env.RATE_LIMIT_RETENTION_MS || windowMs * 10);
    const intervalMs = Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || Math.min(retentionMs, 60_000));
    cleanupTimer = setInterval(() => {
        ensureLimiter().cleanup(retentionMs).catch(err => {
            log.warn({ err }, '[RateLimit] cleanup failed');
            incMetric('rate_limit_cleanup_error');
        });
    }, intervalMs).unref?.();
}

function buildKey(req: Request): string {
    const userId = (req as any).user?.discordId || 'anon';
    const path = req.path.replace(/\d+/g, ':id');
    return `user:${userId}:route:${req.method}:${path}`;
}

function routeLabel(req: Request): string {
    return `${req.method}:${req.path.replace(/\d+/g, ':id')}`;
}

export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (SKIP) return next();
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_TESTS !== '1') {
        return next();
    }
    try {
        const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
        const limit = Number(process.env.RATE_LIMIT_DEFAULT || 60);
        const result = await ensureLimiter().consume(buildKey(req), 1, windowMs, limit);
        res.setHeader('X-RateLimit-Limit', String(result.limit));
        res.setHeader('X-RateLimit-Remaining', String(result.remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.floor(result.resetAt.getTime() / 1000)));
        if (!result.allowed) {
            const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
            res.setHeader('Retry-After', String(retryAfterSeconds));
            incMetric('rate_limit_denied', { route: routeLabel(req) });
            res.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Rate limit exceeded', retryAfterSeconds } });
            return;
        }
        next();
    } catch (err) {
        log.error({ err }, '[RateLimit] Unexpected error');
        next();
    }
}
