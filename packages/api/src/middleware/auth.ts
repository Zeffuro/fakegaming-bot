import {expressjwt} from 'express-jwt';
import type {Request, Response, NextFunction} from 'express';
import { isServiceRequest } from './serviceAuth.js';
import { getLogger } from '@zeffuro/fakegaming-common';
import { requireEnv } from '../utils/env.js';

const log = getLogger({ name: 'api:auth' });

/**
 * Express middleware for JWT authentication.
 * Fails fast if JWT_SECRET or JWT_AUDIENCE are missing (except in test env).
 */
export const jwtAuth = (req: Request, res: Response, next: NextFunction) => {
    let JWT_SECRET: string;
    let JWT_AUDIENCE: string;
    let JWT_ISSUER: string;
    try {
        JWT_SECRET = requireEnv('JWT_SECRET', {allowTestFallback: true});
        JWT_AUDIENCE = requireEnv('JWT_AUDIENCE', {allowTestFallback: true});
        JWT_ISSUER = requireEnv('JWT_ISSUER', {allowTestFallback: true});
    } catch (err) {
        // Fail fast if required envs are missing
        return next(err);
    }
    return (expressjwt({
        secret: JWT_SECRET,
        algorithms: ['HS256'],
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        requestProperty: 'user',
    }) as any)(req, res, (err: any) => {
        if (err) {
            log.warn({ err }, 'JWT validation error');
        }
        next(err);
    });
};

/**
 * Conditional auth that skips JWT when request is authenticated as an internal service.
 */
export const jwtOrService = (req: Request, res: Response, next: NextFunction) => {
    // In unit tests, this middleware may be invoked with bare objects (no headers).
    // Avoid invoking express-jwt in that case, which could throw before calling next().
    if (process.env.NODE_ENV === 'test' && (req as any).headers == null) {
        return next();
    }
    if (isServiceRequest(req)) return next();
    return jwtAuth(req, res, next);
};

/**
 * Returns the JWT secret, or throws if missing (except in test env).
 */
export const getJwtSecret = (): string => {
    return requireEnv('JWT_SECRET', {allowTestFallback: true});
};
