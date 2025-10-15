import { Router, type RequestHandler, type IRouter } from 'express';
import { enforceCsrfOnce, skipCsrf } from '../middleware/csrf.js';

/**
 * Wraps an async handler and automatically forwards errors to next()
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Creates a router where all handlers are automatically wrapped.
 * Also auto-enforces CSRF on mutating methods (POST/PUT/PATCH/DELETE) using enforceCsrfOnce.
 * If a route includes skipCsrf, it will be ordered before enforceCsrfOnce.
 */
export function createBaseRouter(): IRouter {
    const router = Router();

    const wrapList = (handlers: any[], isMutating: boolean) => {
        if (!isMutating) return handlers.map((fn) => (typeof fn === 'function' ? asyncHandler(fn) : fn));
        const idx = handlers.indexOf(skipCsrf as any);
        if (idx >= 0) {
            const rest = handlers.slice(0, idx).concat(handlers.slice(idx + 1));
            const ordered = [skipCsrf, enforceCsrfOnce, ...rest];
            return ordered.map((fn) => (typeof fn === 'function' ? asyncHandler(fn) : fn));
        }
        const ordered = [enforceCsrfOnce, ...handlers];
        return ordered.map((fn) => (typeof fn === 'function' ? asyncHandler(fn) : fn));
    };

    // Wraps route handlers for all supported methods
    const wrapMethod = (method: keyof IRouter) => {
        const original = (router as any)[method] as (...args: any[]) => any;
        const isMutating = method === 'post' || method === 'put' || method === 'patch' || method === 'delete';
        return (...args: any[]) => {
            const [first, ...rest] = args;
            if (typeof first === 'string' || first instanceof RegExp) {
                const wrapped = wrapList(rest, isMutating);
                return original.call(router, first, ...wrapped);
            } else {
                const wrapped = wrapList(args, isMutating);
                return original.call(router, ...wrapped);
            }
        };
    };

    // Apply wrapping for supported methods
    ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all', 'use'].forEach(method => {
        (router as any)[method] = wrapMethod(method as keyof IRouter);
    });

    return router as unknown as IRouter;
}
