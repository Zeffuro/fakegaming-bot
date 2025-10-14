import {expressjwt} from 'express-jwt';
import type {Request, Response, NextFunction} from 'express';

const DEFAULT_SECRET = 'testsecret';

export const jwtAuth = (req: Request, res: Response, next: NextFunction) => {
    const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
    const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "fakegaming-dashboard";
    const JWT_ISSUER = process.env.JWT_ISSUER || "fakegaming";
    return expressjwt({
        secret: JWT_SECRET,
        algorithms: ['HS256'],
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        requestProperty: 'user',
    })(req, res, (err) => {
        if (err) {
            console.error('JWT validation error:', err);
        }
        next(err);
    });
};

export const getJwtSecret = (): string => {
    return process.env.JWT_SECRET || DEFAULT_SECRET;
};
