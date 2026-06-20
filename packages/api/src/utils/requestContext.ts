import type { Request } from 'express';

export interface SafeRequestContext {
    reqId?: string;
    method: string;
    path: string;
    queryKeys: string[];
    actorId?: string;
}

export function getRequestId(req: Request): string | undefined {
    const header = req.headers['x-request-id'];
    if (typeof header === 'string' && header.trim().length > 0) return header.trim();
    if (Array.isArray(header) && typeof header[0] === 'string' && header[0].trim().length > 0) return header[0].trim();

    const maybeRequestId = (req as { requestId?: unknown }).requestId;
    return typeof maybeRequestId === 'string' && maybeRequestId.length > 0 ? maybeRequestId : undefined;
}

export function getSafeRequestPath(req: Request): string {
    return req.path || req.url.split('?')[0] || req.url;
}

export function getRouteLabel(req: Request): string {
    return `${req.method}:${getSafeRequestPath(req).replace(/\d+/g, ':id')}`;
}

export function getSafeRequestContext(req: Request): SafeRequestContext {
    const user = (req as { user?: { discordId?: string } }).user;
    return {
        reqId: getRequestId(req),
        method: req.method,
        path: getSafeRequestPath(req),
        queryKeys: Object.keys(req.query ?? {}),
        actorId: user?.discordId,
    };
}
