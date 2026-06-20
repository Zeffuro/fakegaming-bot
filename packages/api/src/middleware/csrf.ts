import type { Request, Response, NextFunction } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, validateCsrf } from '@zeffuro/fakegaming-common/security';
import { getLogger, incMetric } from '@zeffuro/fakegaming-common';
import { getSafeRequestContext } from '../utils/requestContext.js';

// Per-request CSRF state without augmenting Express types
const csrfState = new WeakMap<Request, { checked: boolean; valid: boolean }>();
const csrfSkipped = new WeakSet<Request>();
const log = getLogger({ name: 'api:csrf' });

function parseCookies(header: string | undefined): Map<string, string> {
    const map = new Map<string, string>();
    if (!header) return map;
    const parts = header.split(';');
    for (const part of parts) {
        const [rawKey, ...rest] = part.split('=');
        const key = rawKey.trim();
        const value = rest.join('=').trim();
        if (!key) continue;
        try {
            map.set(key, decodeURIComponent(value));
        } catch {
            // Fallback to raw value if malformed percent-encoding present
            map.set(key, value);
        }
    }
    return map;
}

function denyCsrf(req: Request, res: Response, details: string): void {
    log.warn({ ...getSafeRequestContext(req), details }, 'CSRF validation failed');
    incMetric('csrf_denied');
    res.status(403).json({ error: 'CSRF', details });
}

/** Core CSRF enforcement. Sets request state so future checks can short-circuit. */
export function enforceCsrf(req: Request, res: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_CSRF_TESTS !== '1') {
        next();
        return;
    }
    // Allow explicit skip for routes like /auth/login
    if (csrfSkipped.has(req)) {
        next();
        return;
    }

    // Short-circuit if already checked and valid/invalid
    const state = csrfState.get(req);
    if (state?.checked) {
        if (state.valid) {
            next();
            return;
        }
        denyCsrf(req, res, 'Invalid CSRF token');
        return;
    }

    const cookiesMap = (req as any).cookies
        ? new Map<string, string>(Object.entries((req as any).cookies as Record<string, string>))
        : parseCookies(req.headers['cookie'] as string | undefined);

    const result = validateCsrf({
        method: req.method,
        headers: { get: (name: string) => req.header(name) ?? null },
        cookies: { get: (name: string) => {
            const v = cookiesMap.get(name);
            return typeof v === 'string' ? { value: v } : undefined;
        } }
    });

    // Persist result on request for any subsequent checks
    csrfState.set(req, { checked: true, valid: result.valid });

    if (result.valid) {
        next();
        return;
    }
    denyCsrf(req, res, result.error ?? 'Invalid CSRF token');
}

/** Wrapper that ensures CSRF is enforced at most once per request. */
export function enforceCsrfOnce(req: Request, res: Response, next: NextFunction): void {
    const state = csrfState.get(req);
    if (state?.checked) {
        if (state.valid) {
            next();
            return;
        }
        denyCsrf(req, res, 'Invalid CSRF token');
        return;
    }
    enforceCsrf(req, res, next);
}

/** Middleware to explicitly skip CSRF for a route (e.g., /auth/login). */
export function skipCsrf(req: Request, _res: Response, next: NextFunction): void {
    csrfSkipped.add(req);
    next();
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
