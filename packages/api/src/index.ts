import {bootstrapEnv, getConfigManager} from '@zeffuro/fakegaming-common';

bootstrapEnv(import.meta.url);
import app, {swaggerSpec, swaggerUi} from './app.js';
import {injectOpenApiSchemas} from "./utils/openapi-inject-schemas.js";

const port = process.env.PORT || 3001;

// Remove all app setup code, keep only the server start logic
async function startServer() {
    try {
        await getConfigManager().init();
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
