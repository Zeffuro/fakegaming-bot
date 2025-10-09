import {bootstrapEnv} from '@zeffuro/fakegaming-common/core';
bootstrapEnv(import.meta.url);

import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {ensureRedis} from '@zeffuro/fakegaming-common';
import app, { swaggerSpec, swaggerUi } from './app.js';
import {injectOpenApiSchemas} from './utils/openapi-inject-schemas.js';
import { pathToFileURL } from 'url';
import path from 'path';

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
        await getConfigManager().init();
        await ensureRedis(process.env.REDIS_URL || '');
        injectOpenApiSchemas(swaggerSpec);
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
        app.listen(port, () => {
            console.log(`API server running on port ${port}\nYou can access the API documentation at http://localhost:${port}/api-docs`);
        });
    };
    // Fire and forget
    start().catch((err) => {
        console.error('Failed to start server', err);
        process.exit(1);
    });
}

// Export the app for tests (setupApiRouteTest expects default export)
export default app;
