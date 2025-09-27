import {expressjwt} from 'express-jwt';
import type {Request, Response, NextFunction} from 'express';

const DEFAULT_SECRET = 'testsecret';

export const jwtAuth = (req: Request, res: Response, next: NextFunction) => {
    const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
    return expressjwt({
        secret: JWT_SECRET,
        algorithms: ['HS256'],
    })(req, res, next);
};

export const getJwtSecret = (): string => {
    return process.env.JWT_SECRET || DEFAULT_SECRET;
};
