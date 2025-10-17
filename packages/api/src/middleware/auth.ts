import {expressjwt} from 'express-jwt';
import type {Request, Response, NextFunction} from 'express';
import { isServiceRequest } from './serviceAuth.js';

/**
 * Throws if required JWT env vars are missing (except in test env).
 */
function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (value) return value;
    if (process.env.NODE_ENV === 'test') {
        // Allow fallback for tests only
        if (name === 'JWT_SECRET') return 'testsecret';
        if (name === 'JWT_AUDIENCE') return 'fakegaming-dashboard';
        if (name === 'JWT_ISSUER') return 'fakegaming';
    }
    throw new Error(`Missing required environment variable: ${name}`);
}

/**
 * Express middleware for JWT authentication.
 * Fails fast if JWT_SECRET or JWT_AUDIENCE are missing (except in test env).
 */
export const jwtAuth = (req: Request, res: Response, next: NextFunction) => {
    let JWT_SECRET: string;
    let JWT_AUDIENCE: string;
    let JWT_ISSUER: string;
    try {
        JWT_SECRET = getRequiredEnv('JWT_SECRET');
        JWT_AUDIENCE = getRequiredEnv('JWT_AUDIENCE');
        JWT_ISSUER = getRequiredEnv('JWT_ISSUER');
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
            console.error('JWT validation error:', err);
        }
        next(err);
    });
};

/**
 * Conditional auth that skips JWT when request is authenticated as an internal service.
 */
export const jwtOrService = (req: Request, res: Response, next: NextFunction) => {
    if (isServiceRequest(req)) return next();
    return jwtAuth(req, res, next);
};

/**
 * Returns the JWT secret, or throws if missing (except in test env).
 */
export const getJwtSecret = (): string => {
    return getRequiredEnv('JWT_SECRET');
};
