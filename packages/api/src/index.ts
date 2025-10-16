import './earlyEnv.js';
import {bootstrapEnv, getConfigManager, ensureRedis, getLogger, startMetricsSummaryLogger} from '@zeffuro/fakegaming-common';
bootstrapEnv(import.meta.url);

import app, { swaggerSpec, swaggerUi } from './app.js';
import {injectOpenApiSchemas} from './utils/openapi-inject-schemas.js';
import { pathToFileURL } from 'url';
import path from 'path';
import { scheduleRateLimitCleanup } from './middleware/rateLimit.js';

const log = getLogger({ name: 'api' });

function requireEnv(name: string): string {
    const val = process.env[name];
    if (!val || val.trim() === '') {
        // Fail fast in production and during startup if missing
        throw new Error(`[api] Missing required environment variable: ${name}`);
    }
    return val;
}

// Security-critical env vars must be present
requireEnv('JWT_SECRET');
requireEnv('JWT_AUDIENCE');
requireEnv('JWT_ISSUER');

const port = process.env.PORT || 3001;

// Only perform heavy initialization when running directly (not during tests)
const isDirectRun = (() => {
    try {
        const entry = process.argv[1];
        if (!entry) return false;
        return pathToFileURL(path.resolve(entry)).href === import.meta.url;
    } catch {
        return false;
    }
})();

if (isDirectRun) {
    const start = async () => {
        // Start periodic metrics summary logs early
        startMetricsSummaryLogger({ service: 'api', loggerName: 'api:metrics' });
        await getConfigManager().init();
        await ensureRedis(process.env.REDIS_URL || '');
        injectOpenApiSchemas(swaggerSpec);
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
        scheduleRateLimitCleanup();
        app.listen(port, () => {
            log.info(`API server running on port ${port}`);
        });
    };
    // Fire and forget
    start().catch((err) => {
        log.error({ err }, 'Failed to start server');
        process.exit(1);
    });
}

// Export the app for tests (setupApiRouteTest expects default export)
export default app;
