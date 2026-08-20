import type { Request, Response } from 'express';
import type { ApiCopyKey } from './catalog.js';
import { apiText, requestLocale } from './locale.js';

export function sendLocalizedError(
    req: Request,
    res: Response,
    status: number,
    code: string,
    key: ApiCopyKey,
    values: Readonly<Record<string, string | number>> = {},
): Response {
    return res.status(status).json({ error: { code, message: apiText(requestLocale(req), key, values) } });
}
