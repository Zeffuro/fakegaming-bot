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
    console.error(`${logPrefix} ${error}`);
    return res.status(500).json({ error: defaultMsg });
}

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}

