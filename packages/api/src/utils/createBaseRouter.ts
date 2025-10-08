import { Router, type RequestHandler, type IRouter } from 'express';

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
 * Works with TypeScript without breaking IRouter types.
 */
export function createBaseRouter(): IRouter {
    const router = Router();

    // Wraps route handlers for all supported methods
    const wrapMethod = (method: keyof IRouter) => {
        const original = (router as any)[method] as (...args: any[]) => any;
        return (...args: any[]) => {
            const [first, ...rest] = args;
            if (typeof first === 'string' || first instanceof RegExp) {
                const wrapped = rest.map((fn: any) => (typeof fn === 'function' ? asyncHandler(fn) : fn));
                return original.call(router, first, ...wrapped);
            } else {
                const wrapped = args.map((fn: any) => (typeof fn === 'function' ? asyncHandler(fn) : fn));
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
