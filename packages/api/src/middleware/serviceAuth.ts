import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/express.js';
import { skipCsrf } from './csrf.js';
import { getLogger, incMetric } from '@zeffuro/fakegaming-common';
import { getSafeRequestContext } from '../utils/requestContext.js';

const SERVICE_FLAG = Symbol.for('fakegaming.service');
const SKIP_JWT_FLAG = Symbol.for('fakegaming.skipJwt');
const log = getLogger({ name: 'api:service-auth' });

function getServiceTokens(): string[] {
    return [
        process.env.SERVICE_API_TOKEN,
        process.env.INTERNAL_API_TOKEN,
        process.env.API_SERVICE_TOKEN,
    ]
        .map((value) => value?.trim() ?? '')
        .filter((value) => value.length > 0);
}

export function tokenMatches(presentedToken: string, configuredTokens: readonly string[]): boolean {
    const presented = Buffer.from(presentedToken);

    return configuredTokens.some((configuredToken) => {
        const configured = Buffer.from(configuredToken);

        return configured.length === presented.length && timingSafeEqual(configured, presented);
    });
}

/**
 * Express middleware: if X-Service-Token matches a configured env token, treat as internal service request.
 * - Sets req.user to a synthetic service identity
 * - Skips CSRF checks for this request
 * - Flags request so global JWT middleware can be bypassed
 */
export function serviceAuth(req: Request, res: Response, next: NextFunction): void {
    const tokens = getServiceTokens();
    if (tokens.length === 0) return next();

    const hdr = req.header('x-service-token');
    if (!hdr) return next();
    if (!tokenMatches(hdr, tokens)) {
        incMetric('service_auth_denied');
        log.warn(getSafeRequestContext(req), 'Invalid service token presented');
        return next();
    }

    // Attach minimal user to satisfy downstream types/guards
    (req as AuthenticatedRequest).user = {
        discordId: 'service:bot',
        username: 'service',
    } as const;

    // Mark request as service and skip CSRF for it
    (req as any)[SERVICE_FLAG] = true;
    (req as any)[SKIP_JWT_FLAG] = true;
    try {
        // Mark CSRF to be skipped for this request
        skipCsrf(req, res, () => undefined);
    } catch {
        // ignore
    }

    next();
}

/** Returns true if the current request is authenticated as an internal service. */
export function isServiceRequest(req: Request): boolean {
    return Boolean((req as any)[SERVICE_FLAG]);
}

/** Returns true if JWT middleware should be skipped for this request. */
export function shouldSkipJwt(req: Request): boolean {
    return Boolean((req as any)[SKIP_JWT_FLAG]);
}

export { SERVICE_FLAG, SKIP_JWT_FLAG };
