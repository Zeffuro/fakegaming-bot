import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, NotFoundError } from '@zeffuro/fakegaming-common';

describe('errorHandler extra branches', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let json: ReturnType<typeof vi.fn>;
    let status: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        json = vi.fn();
        status = vi.fn().mockReturnValue({ json });
        req = {};
        res = { status, json } as Partial<Response>;
        next = vi.fn();
    });

    it('maps NotFoundError to 404', () => {
        const err = new NotFoundError('missing');
        errorHandler(err, req as Request, res as Response, next);
        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ error: 'Not Found', message: 'missing' });
    });

    it('maps ForbiddenError to 403', () => {
        const err = new ForbiddenError('nope');
        errorHandler(err, req as Request, res as Response, next);
        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith({ error: 'Forbidden', message: 'nope' });
    });

    it('maps explicit status object to proper title (403)', () => {
        const err = { status: 403, message: 'not allowed' };
        errorHandler(err, req as Request, res as Response, next);
        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith({ error: 'Forbidden', message: 'not allowed' });
    });

    it('treats sqlite constraint as 409 Conflict', () => {
        const err = { code: 'SQLITE_CONSTRAINT', message: 'UNIQUE constraint failed' };
        errorHandler(err, req as Request, res as Response, next);
        expect(status).toHaveBeenCalledWith(409);
        expect(json).toHaveBeenCalledWith({ error: 'Conflict', message: 'Duplicate entry' });
    });

    it('treats error message with "invalid" as 400 Bad Request', () => {
        const err = { message: 'invalid payload' };
        errorHandler(err, req as Request, res as Response, next);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({ error: 'Bad Request', message: 'invalid payload' });
    });
});

