import {expressjwt} from 'express-jwt';
import type {Request, Response, NextFunction} from 'express';

export const jwtAuth = (req: Request, res: Response, next: NextFunction) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        // Respond with 500 error if missing
        res.status(500).json({error: 'JWT_SECRET environment variable is required'});
        return;
    }
    return expressjwt({
        secret: JWT_SECRET,
        algorithms: ['HS256'],
    })(req, res, next);
};

export const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET environment variable is required');
    return secret;
};
