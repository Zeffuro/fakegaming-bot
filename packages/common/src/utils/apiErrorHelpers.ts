/**
 * Shared API error handler for Express routes.
 * Returns the correct status code and error message for NotFound, Forbidden, and generic errors.
 *
 * @param res Express response object
 * @param error The error thrown (unknown)
 * @param notFoundMsg Fallback message for not found
 * @param forbiddenMsg Fallback message for forbidden
 * @param logPrefix Prefix for error logs
 * @param defaultMsg Fallback message for generic errors
 */
import { getLogger } from './logger.js';

// Keep a module-local logger so tests can inject a spyable instance
let __apiErrorLogger: { error: (obj: unknown, msg?: string) => void } = getLogger({ name: 'common:apiError' });

/** Exported for tests to spy/mock the logger used by this module. */
export function __getApiErrorLogger() {
    return __apiErrorLogger;
}

/** Exported for tests to inject a custom logger (e.g., with spies). */
export function __setApiErrorLogger(logger: { error: (obj: unknown, msg?: string) => void }) {
    __apiErrorLogger = logger;
}

export function handleApiError(
    res: any,
    error: unknown,
    notFoundMsg: string,
    forbiddenMsg: string,
    logPrefix: string,
    defaultMsg: string
) {
    let msg = '';
    if (error instanceof Error) {
        msg = error.message.toLowerCase();
    }
    if (error instanceof NotFoundError || msg.includes('not found')) {
        return res.status(404).json({ error: error instanceof Error ? error.message : notFoundMsg });
    }
    if (error instanceof ForbiddenError || msg.includes('forbidden')) {
        return res.status(403).json({ error: error instanceof Error ? error.message : forbiddenMsg });
    }
    __getApiErrorLogger().error({ err: error }, `${logPrefix}`);
    return res.status(500).json({ error: defaultMsg });
}

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}
