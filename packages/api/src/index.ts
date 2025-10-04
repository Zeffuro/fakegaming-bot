import {bootstrapEnv} from '@zeffuro/fakegaming-common/core';
bootstrapEnv(import.meta.url);

import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {ensureRedis} from '@zeffuro/fakegaming-common';
import app, {swaggerSpec, swaggerUi} from './app.js';
import {injectOpenApiSchemas} from "./utils/openapi-inject-schemas.js";

const port = process.env.PORT || 3001;

// Remove all app setup code, keep only the server start logic
async function startServer() {
    try {
        await getConfigManager().init();
        await ensureRedis(process.env.REDIS_URL || '');
        // Inject OpenAPI schemas after DB init
        injectOpenApiSchemas(swaggerSpec);
        console.log('OpenAPI schemas injected:', Object.keys((swaggerSpec as any).components.schemas));
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
        app.listen(port, () => {
            console.log(`API server running on port ${port}\nYou can access the API documentation at http://localhost:${port}/api-docs`);
        });
    } catch (err) {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    }
}

startServer();
