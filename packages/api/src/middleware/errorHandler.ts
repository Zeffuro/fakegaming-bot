import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, NotFoundError, getLogger, incMetric } from '@zeffuro/fakegaming-common';

const log = getLogger({ name: 'api:error' });

/**
 * Centralized API error handler for async routers.
 * Catches domain errors, validation errors, database duplicates, and unexpected errors.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    // Unauthorized (from express-jwt)
    if (err?.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Unauthorized', message: err.message ?? 'Unauthorized' });
    }

    // Domain-specific errors
    if (err instanceof NotFoundError) {
        return res.status(404).json({ error: 'Not Found', message: err.message || 'Not Found' });
    }
    if (err instanceof ForbiddenError) {
        return res.status(403).json({ error: 'Forbidden', message: err.message || 'Forbidden' });
    }

    // Explicit status & message (for thrown {status, message} objects)
    if (typeof err?.status === 'number' && typeof err?.message === 'string') {
        const status = err.status as number;
        const title = status === 400 ? 'Bad Request'
            : status === 404 ? 'Not Found'
            : status === 403 ? 'Forbidden'
            : status === 401 ? 'Unauthorized'
            : status === 409 ? 'Conflict'
            : 'Error';
        return res.status(status).json({ error: title, message: err.message });
    }

    // Validation / bad request errors
    if (err?.status === 400 || (typeof err?.message === 'string' && /missing|invalid/i.test(err.message))) {
        return res.status(400).json({ error: 'Bad Request', message: err.message || 'Bad Request' });
    }

    // Database constraint / duplicate errors
    if (err?.code === 'SQLITE_CONSTRAINT' || (typeof err?.message === 'string' && /duplicate/i.test(err.message))) {
        return res.status(409).json({ error: 'Conflict', message: 'Duplicate entry' });
    }

    // Fallback for all other errors
    log.error({ err }, 'Unhandled error in API');
    incMetric('api_error', { type: 'unhandled' });
    res.status(500).json({ error: 'Internal Server Error', message: err?.message ?? 'Unexpected error' });
}
