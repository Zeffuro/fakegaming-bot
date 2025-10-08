import type { Express, Router } from 'express';
import type { ConfigManager } from '../../managers/index.js';

/**
 * Factory function type for creating Express apps with dependencies
 */
export type AppFactory = (deps: AppFactoryDependencies) => Express | Promise<Express>;

/**
 * Dependencies that can be injected into app factory
 */
export interface AppFactoryDependencies {
    configManager: ConfigManager;
    env?: Record<string, string>;
}

/**
 * Factory function type for creating Express routers with dependencies
 */
export type RouterFactory = (deps: RouterFactoryDependencies) => Router | Promise<Router>;

/**
 * Dependencies that can be injected into router factory
 */
export interface RouterFactoryDependencies {
    configManager: ConfigManager;
}

/**
 * Creates a minimal Express app for testing specific routes in isolation
 *
 * @param router The router to mount
 * @param basePath The base path to mount the router at (default: '/api')
 * @returns Express app instance
 */
export async function createTestApp(
    router: Router,
    basePath: string = '/api'
): Promise<Express> {
    const express = await import('express');
    const app = express.default();

    app.use(express.default.json());
    app.use(basePath, router);

    return app;
}

/**
 * Creates a test app with authentication middleware
 *
 * @param router The router to mount
 * @param options Configuration options
 * @returns Express app instance
 */
export async function createAuthenticatedTestApp(
    router: Router,
    options: {
        basePath?: string;
        protectedPaths?: string[];
        publicPaths?: string[];
        jwtSecret?: string;
        jwtAudience?: string;
    } = {}
): Promise<Express> {
    const {
        basePath = '/api',
        protectedPaths = [],
        publicPaths = [],
        jwtSecret: _jwtSecret = 'testsecret',
        jwtAudience: _jwtAudience = 'fakegaming-dashboard'
    } = options;

    const express = await import('express');
    const app = express.default();

    app.use(express.default.json());

    // Apply conditional auth middleware
    if (protectedPaths.length > 0 || publicPaths.length > 0) {
        // Import jwtAuth from API package if available
        try {
            // @ts-expect-error - API package import will be available at runtime in API tests
            const { jwtAuth } = await import('@zeffuro/fakegaming-bot-api/middleware/auth');

            app.use(basePath, (req, res, next) => {
                // Check if path should be public
                const isPublic = publicPaths.some(path => req.path.startsWith(path));
                if (isPublic) {
                    return next();
                }

                // Check if path should be protected
                const isProtected = protectedPaths.length === 0 ||
                    protectedPaths.some(path => req.path.startsWith(path));

                if (isProtected) {
                    return jwtAuth(req, res, next);
                }

                next();
            });
        } catch {
            // If API package not available, skip auth middleware
            console.warn('JWT auth middleware not available - tests will run without authentication');
        }
    }

    app.use(basePath, router);

    return app;
}
